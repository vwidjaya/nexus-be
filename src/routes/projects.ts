import { Application, Router, Request, Response } from 'express';
import { Pool } from 'mysql2/promise';
import passport from 'passport';
import ProjectService from '../services/project';
import { User, Project } from '../types';

const createProject = (srv: ProjectService) => async (req: Request, res: Response): Promise<void> => {
  const project = req.body.project as Project;
  const { username } = req.user as User;

  try {
    const projectId = await srv.createProject(username, project);
    res.json({ projectId });
  } catch (error) {
    res.json({
      error: (error as Error).message,
    });
  }
};

const getProjectById = (srv: ProjectService) => async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;

  try {
    const project = await srv.getProject(projectId);
    res.json({ project });
  } catch (error) {
    res.json({
      error: (error as Error).message,
    });
  }
};

const updateProject = (srv: ProjectService) => async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const project = req.body.project as Project;
  const { username } = req.user as User;

  try {
    await srv.updateProject(username, projectId, project);
    res.json({ success: `Project id: ${projectId} updated.` });
  } catch (error) {
    res.json({
      error: (error as Error).message,
    });
  }
};

const deleteProject = (srv: ProjectService) => async (req: Request, res: Response): Promise<void> => {
  const { projectId } = req.params;
  const { username } = req.user as User;

  try {
    await srv.deleteProject(username, projectId);
    res.json({ success: `Project id: ${projectId} deleted from database.` });
  } catch (error) {
    res.json({
      error: (error as Error).message,
    });
  }
};

const searchProjects = (srv: ProjectService) => async (req: Request, res: Response): Promise<void> => {
  const { filters, offset, count } = req.body;

  filters.details = filters.details || {};
  filters.fields = filters.fields || [];
  filters.skills = filters.skills || [];
  filters.locations = filters.locations || [];

  try {
    const projects = await srv.searchProjects(filters, offset, count);
    res.json({ projects });
  } catch (error) {
    res.json({
      error: (error as Error).message,
    });
  }
};

export default (app: Application, db: Pool): void => {
  const router = Router();
  const projectService = new ProjectService(db);

  router.post('/', createProject(projectService));
  router.get('/:projectId', getProjectById(projectService));
  router.patch('/:projectId', updateProject(projectService));
  router.delete('/:projectId', deleteProject(projectService));
  router.post('/search', searchProjects(projectService));

  app.use('/projects', passport.authenticate('jwt', { session: false }), router);
};
