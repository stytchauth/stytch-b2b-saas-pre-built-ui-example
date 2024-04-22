import { Router } from 'express';
import {
	cookieOptions,
	getAuthenticatedUserInfo,
	loadStytch
} from './index.js';

export const auth = Router();

/**
 * Stytch is organization-first, but it’s still possible for a member to switch
 * organizations without needing to auth again. This is done by exchanging their
 * current session (tied to the current org ID) for a new one that’s tied to the
 * other org ID.
 *
 * @see https://stytch.com/docs/b2b/api/exchange-session
 */
auth.post('/switch-team', async (req, res) => {
	if (req.body.organization_id === 'new') {
		res.redirect('/auth/logout');
		return;
	}

	const stytch = loadStytch();

	const result = await stytch.sessions.exchange({
		organization_id: req.body.organization_id,
		session_token: req.cookies.stytch_session,
	});

	// if there’s a problem (e.g. auth methods don’t match) we need to auth again
	if (result.status_code !== 200) {
		res.redirect('/auth/logout');
		return;
	}

	res.cookie('stytch_session', result.session_token, cookieOptions);

	res.redirect(303, new URL('/dashboard', process.env.APP_URL).toString());
});


/**
 * Revoke all sessions for the current member and clear cookies.
 *
 * @see https://stytch.com/docs/b2b/api/revoke-session
 */
auth.get('/logout', async (req, res) => {
	const stytch = loadStytch();

	const { member } = await getAuthenticatedUserInfo({ req })

	stytch.sessions.revoke({ member_id: member!.member_id });

	res.clearCookie('stytch_session');

	res.redirect(new URL('/dashboard/login', process.env.APP_URL).toString());
});
