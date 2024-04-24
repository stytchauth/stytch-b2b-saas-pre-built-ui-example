/**
 * Important note about this file!
 *
 * The routes in here are for making the example SaaS app function. They’re
 * intended as a reference for how you can handle similar flows in your own app.
 * All of the logic around adding and deleting ideas and users is intended to be
 * replaced with your own SaaS logic.
 *
 * The most relevant things to note are:
 *
 *  - the {@link authenticateAndAuthorize} middleware for authorization checks on custom
 * 		roles and resources
 *  - how member data from Stytch is synced with the app’s database in e.g. the
 * 		`POST /idea` route
 *  - how organization and member settings are surfaced to members so they can
 * 		manage Stytch settings from within the app itself in e.g. `POST /account`
 */

import { Router } from "express";
import {
  authenticate,
  authenticateAndAuthorize,
  getAuthenticatedUserInfo,
  loadStytch,
} from "../auth/index.js";
import {
  addIdea,
  addUser,
  deleteIdea,
  getIdeas,
  getUser,
  updateUserName,
} from "../db/index.js";

export const api = Router();

api.post("/add-member", async (req, res) => {
  const { member_id, name } = req.body;

  // Ensure the member exists in the database
  const currentMember = await getUser(member_id);
  if (!currentMember?.id) {
    await addUser({ id: member_id, name });
  }

  res.json({ ok: true });
});

/**
 * For custom resources in your app that are available to all members, a check
 * for the `stytch.self` role and `*` action is sufficient.
 *
 * @see https://stytch.com/docs/b2b/guides/rbac/stytch-defaults
 */
api.get(
  "/ideas",
  authenticateAndAuthorize("idea", "read"),
  async (req, res) => {
    const { member } = await getAuthenticatedUserInfo({ req });
    const allIdeas = await getIdeas(member!.organization_id);

    res.json(allIdeas);
  },
);

api.post(
  "/idea",
  authenticateAndAuthorize("idea", "create"),
  async (req, res) => {
    const { member } = await getAuthenticatedUserInfo({ req });
    const { organization_id, member_id } = member!;

    const result = await addIdea({
      text: req.body.text,
      status: "pending",
      creator: member_id,
      team: organization_id,
    });

    res.json(result.at(0));
  },
);

/**
 * For custom resources in your app that are only available to privileged roles,
 * you can set up custom resources and actions.
 *
 * @see https://stytch.com/docs/b2b/guides/rbac/overview
 */
api.delete(
  "/idea",
  authenticateAndAuthorize("idea", "delete"),
  async (req, res) => {
    const result = await deleteIdea(req.body.ideaId);

    res.json(result.at(0));
  },
);

/**
 * When the action you’re protecting is specific to Stytch (e.g. loading member
 * or organization details), the Stytch session can be passed direclty into the
 * SDK calls instead of performing a separate permission check.
 *
 * This flow is described in the “RBAC-gated endpoints in the API” section of
 * the Stytch docs.
 *
 * @see https://stytch.com/docs/b2b/guides/rbac/authorization-checks
 */
api.get("/team", async (req, res) => {
  const stytch = loadStytch();

  const { member } = await getAuthenticatedUserInfo({ req });

  const response = await stytch.organizations.members.search(
    {
      organization_ids: [member!.organization_id],
    },
    {
      // passing the JWT here enforces RBAC for the member
      authorization: {
        session_token: req.cookies.stytch_session,
      },
    },
  );

  /*
   * Not all the details of each member need to be sent to the client. Mapping
   * over the results to choose only the fields we need reduces how much data
   * is sent in each request and is a good privacy practice.
   */
  const members = response.members.map((member) => {
    return {
      id: member.member_id,
      name: member.name,
      email: member.email_address,
      status: member.status,
      roles: member.roles,
    };
  });

  res.json({
    members,
    meta: {
      invites_allowed:
        Object.values(response.organizations).at(0)?.email_invites ===
        "ALL_ALLOWED",
    },
  });
});

api.get("/team-settings", authenticate(), async (req, res) => {
  const stytch = loadStytch();

  const { member } = await getAuthenticatedUserInfo({ req });

  const response = await stytch.organizations.get({
    organization_id: member!.organization_id,
  });

  res.json(response.organization);
});

api.post(
  "/team-settings",
  authenticateAndAuthorize("stytch.organization", "*"),
  async (req, res) => {
    const stytch = loadStytch();
    const { member } = await getAuthenticatedUserInfo({ req });

    const {
      email_invites,
      allowed_auth_methods,
      email_allowed_domains,
      email_jit_provisioning,
    } = req.body;
    const auth_methods = [
      "sso",
      "magic_link",
      "password",
      "google_oauth",
      "microsoft_oauth",
    ].every((m) => allowed_auth_methods.includes(m))
      ? "ALL_ALLOWED"
      : "RESTRICTED";

    const params: any = {
      organization_id: member!.organization_id,
      allowed_auth_methods,
      auth_methods,
      email_invites: email_invites ? "ALL_ALLOWED" : "NOT_ALLOWED",
    };

    if (email_allowed_domains.length > 0) {
      params.email_allowed_domains = email_allowed_domains
        .split(",")
        .map((d: string) => d.trim());
    }

    if (email_jit_provisioning && email_allowed_domains.length > 0) {
      params.email_jit_provisioning = "RESTRICTED";
    } else {
      params.email_jit_provisioning = "NOT_ALLOWED";
    }

    const response = await stytch.organizations.update(params, {
      // passing the JWT here enforces RBAC for the member
      authorization: {
        session_token: req.cookies.stytch_session,
      },
    });

    if (response.status_code !== 200) {
      res.sendStatus(response.status_code);
    }

    res.redirect(
      new URL("/dashboard/team-settings", process.env.APP_URL).toString(),
    );
  },
);

api.get("/account", authenticate(), async (req, res) => {
  const { member } = await getAuthenticatedUserInfo({ req });

  res.json(member);
});

api.post("/account", async (req, res) => {
  const stytch = loadStytch();

  const { member } = await getAuthenticatedUserInfo({ req });

  const response = await stytch.organizations.members.update(
    {
      organization_id: member!.organization_id,
      member_id: member!.member_id,
      name: req.body.name,
    },
    {
      // passing the JWT here enforces RBAC for the member
      authorization: {
        session_token: req.cookies.stytch_session,
      },
    },
  );

  await updateUserName(member!.member_id, req.body.name);

  if (response.status_code !== 200) {
    res.sendStatus(response.status_code);
  }

  res.redirect(new URL("/dashboard/account", process.env.APP_URL).toString());
});
