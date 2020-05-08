import { Pool, RowDataPacket } from 'mysql2/promise';
import { Project, ProjectDetails, Contract } from '../../types';
import * as SQL from './sql';

export default class ProjectService {
  db: Pool;

  constructor(promisePool: Pool) {
    this.db = promisePool;
  }

  async validateOwner(projectId: string, username: string): Promise<void> {
    const [res] = await this.db.execute(SQL.getOwnerUsername, [projectId]);
    if (!res[0] || username != res[0].username) {
      throw new Error('Unauthorized operation on project.');
    }
  }

  async createProject(username: string, details: ProjectDetails): Promise<string> {
    const { title, description, size, duration, postal } = details;
    const conn = await this.db.getConnection();

    try {
      conn.beginTransaction();
      const projectParams = [username, title, description, size, duration, postal];
      const [projectRes] = await conn.execute(SQL.insertProject(), projectParams);
      const projectId = projectRes['insertId'];

      await conn.commit();
      conn.release();

      return projectId;
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  }

  async getProjectDetails(projectId: string): Promise<ProjectDetails> {
    try {
      const [res] = await this.db.execute(SQL.getProjectDetailsById, [projectId]);
      let projectDetails: ProjectDetails;

      if (res[0]) {
        projectDetails = {
          owner: {
            user: { username: res[0].ownerUsername },
            firstName: res[0].ownerFirstName,
            lastName: res[0].ownerLastName,
            email: res[0].ownerEmail,
          },
          title: res[0].title,
          description: res[0].description,
          status: res[0].status,
          duration: res[0].duration,
          size: res[0].size,
          postal: res[0].postal,
          createdAt: res[0].createdAt,
          updatedAt: res[0].updatedAt,
        };
      }

      return projectDetails;
    } catch (err) {
      throw err;
    }
  }

  async getProjectsOwned(username: string): Promise<ProjectDetails[]> {
    try {
      const [res] = await this.db.execute(SQL.getProjectsOwned, [username]);
      return res as ProjectDetails[];
    } catch (err) {
      throw err;
    }
  }

  async getProject(projectId: string): Promise<Project> {
    try {
      const projectDetails = await this.getProjectDetails(projectId);
      if (!projectDetails) return null;

      const [skillsRes] = await this.db.execute(SQL.getProjectSkills, [projectId]);
      const [rolesRes] = await this.db.execute(SQL.getProjectRoles, [projectId]);
      const [interestsRes] = await this.db.execute(SQL.getProjectInterests, [projectId]);

      const project = {
        details: projectDetails,
        skills: (skillsRes as RowDataPacket[]).map(row => row.skill),
        roles: (rolesRes as RowDataPacket[]).map(row => row.role),
        interests: (interestsRes as RowDataPacket[]).map(row => row.interest),
      };

      return project;
    } catch (err) {
      throw err;
    }
  }

  async getProjectContracts(username: string, projectId: string): Promise<Contract[]> {
    await this.validateOwner(projectId, username);

    try {
      const [contractsRes] = await this.db.execute(SQL.getProjectContracts, [projectId]);

      const contracts: Contract[] = (contractsRes as RowDataPacket[]).map(c => ({
        contractId: c.contractId,
        startDate: c.startDate,
        endDate: c.endDate,
        status: c.status,
        student: {
          firstName: c.firstName,
          lastName: c.lastName,
          user: {
            username: c.username,
          },
        },
      }));

      return contracts;
    } catch (err) {
      throw err;
    }
  }

  async updateProject(username: string, projectId: string, project: Project): Promise<void> {
    await this.validateOwner(projectId, username);
    const { details, skills, roles, interests } = project;
    const conn = await this.db.getConnection();

    try {
      conn.beginTransaction();

      if (details) {
        const projectParams = [
          details.title,
          details.description,
          details.size,
          details.duration,
          details.status,
          details.postal,
        ].filter(Boolean);
        await conn.execute(SQL.updateProjectDetails(details), [...projectParams, projectId]);
      }

      if (skills && skills.length) {
        await conn.execute(SQL.addToArrayCatalog('skill', skills), skills);
        await conn.execute(SQL.deleteOldProjectArrayItems('skill', skills), [projectId, ...skills]);
        await conn.execute(SQL.insertNewProjectArrayItems('skill', skills), [projectId, ...skills]);
      } else {
        await conn.execute(SQL.deleteProjectSkills, [projectId]);
      }

      if (roles && roles.length) {
        await conn.execute(SQL.addToArrayCatalog('role', roles), roles);
        await conn.execute(SQL.deleteOldProjectArrayItems('role', roles), [projectId, ...roles]);
        await conn.execute(SQL.insertNewProjectArrayItems('role', roles), [projectId, ...roles]);
      } else {
        await conn.execute(SQL.deleteProjectRoles, [projectId]);
      }

      if (interests && interests.length) {
        await conn.execute(SQL.addToArrayCatalog('interest', interests), interests);
        await conn.execute(SQL.deleteOldProjectArrayItems('interest', interests), [projectId, ...interests]);
        await conn.execute(SQL.insertNewProjectArrayItems('interest', interests), [projectId, ...interests]);
      } else {
        await conn.execute(SQL.deleteProjectInterests, [projectId]);
      }

      await conn.commit();
      conn.release();
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  }

  async deleteProject(username: string, projectId: string): Promise<void> {
    await this.validateOwner(projectId, username);
    const conn = await this.db.getConnection();

    try {
      conn.beginTransaction();
      await conn.execute(SQL.deleteProjectSkills, [projectId]);
      await conn.execute(SQL.deleteProjectRoles, [projectId]);
      await conn.execute(SQL.deleteProjectInterests, [projectId]);
      await conn.execute(SQL.deleteProject, [projectId]);
      await conn.commit();
      conn.release();
    } catch (err) {
      await conn.rollback();
      conn.release();
      throw err;
    }
  }

  async searchProjects(filters: Project, lastScore: number = null, lastId: number = null): Promise<Project[]> {
    const { title, size, duration, status } = filters.details;
    const { interests, skills, roles } = filters;

    const m2mParams = [...interests, ...skills, ...roles];
    const detailsParams = [title, size, duration, status];
    const finalParams = [...m2mParams, ...detailsParams, lastScore, lastScore, lastId].filter(Boolean);

    const [res] = await this.db.execute(SQL.searchProjects(filters, lastScore, lastId), finalParams);
    const projects: Project[] = (res as RowDataPacket[]).map(row => {
      return {
        details: {
          projectId: row.projectId,
          title: row.title,
          status: row.status,
          duration: row.duration,
          size: row.size,
          postal: row.postal,
        },
        skills: row.skills ? row.skills.split(',') : [],
        roles: row.roles ? row.roles.split(',') : [],
        interests: row.interests ? row.interests.split(',') : [],
        score: row.score,
      };
    });

    return projects;
  }
}
