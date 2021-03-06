// [userType, username, password]
export const insertUser = `
  INSERT INTO user
  VALUES (null, (SELECT user_type_id FROM user_type WHERE name = ?), ?, ?);
`;

// [username]
export const findUser = `
  SELECT
    U.user_id AS userId,
    U.username,
    U.password,
    T.name AS userType
  FROM user U
  JOIN user_type T ON T.user_type_id = U.user_type_id
  WHERE username = ?;
`;

// [email]
export const findUserByEmail = `
  SELECT
    U.user_id AS userId,
    U.username,
    U.password,
    T.name AS userType
  FROM user U
  JOIN user_type T ON T.user_type_id = U.user_type_id
  JOIN student S ON S.user_id = U.user_id
  WHERE S.email = ?;
`;

// [password, username]
export const resetUserPassword = `UPDATE user SET password = ? WHERE username = ?;`;
