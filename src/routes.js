/* eslint-disable linebreak-style */
import { Router } from 'express';
import User from './app/models/User';

import UserController from './app/controllers/UserController';

const routes = new Router();

routes.post('/users', UserController.store);

routes.get('/users', (req, res) => {
  res.json({ message: 'Opaaaaa!' });
});

export default routes;
