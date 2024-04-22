import express, { type Application } from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import cookieParser from 'cookie-parser';
import { api } from '../api/routes.js';
import { auth } from '../auth/routes.js';

const app: Application = express();
const port = 3000;

app.use(cors({ origin: true, credentials: true }));
app.use(cookieParser());
app.use(bodyParser.urlencoded({ extended: false }));

app.use('/api', api);
app.use('/auth', auth);

app.listen(port, () => {
	console.log(`Example app listening on port ${port}`);
});
