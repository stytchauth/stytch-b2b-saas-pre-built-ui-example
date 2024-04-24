/**
 * NOTE: Everything in this file is intended for demonstration purposes only!
 *
 * Nothing in this file is required to create a B2B SaaS app with Stytch. In
 * fact, you can safely delete this entire file and build your pages however
 * you want. This is intended as a reference for how you *could* set up an app,
 * not as an assertion that you *should* set one up this way.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Header } from "./header";
import { Idea } from "./idea";

import type { Member } from "@stytch/vanilla-js";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import styles from "./pages.module.css";

/**
 * This is a helper component to abstract over using TanStack Query for the most
 * comment use case in this app (a GET call to the API). It’s a little complex,
 * but don’t stress if it doesn’t make sense — this component has nothing to do
 * with the Stytch implementation.
 *
 * But if you’re curious, this component combines TanStack Query and the
 * “function as child component” pattern to allow for debugging defaults with
 * a way to quickly modify the output without needing to duplicate the query
 * logic.
 *
 * @see https://tanstack.com/query/latest/docs/framework/react/guides/queries
 * @see https://reactpatterns.js.org/docs/function-as-child-component/
 */
const PageWithQuery = ({
  heading,
  apiRoute,
  staleTime,
  children,
}: {
  heading: string;
  apiRoute: string;
  staleTime?: number;
  children?({
    data,
    isPending,
    error,
  }: {
    data: any;
    isPending: boolean;
    error: any;
  }): any;
}) => {
  const { isPending, error, data } = useQuery({
    queryKey: [apiRoute],
    queryFn: () => {
      const api = new URL(apiRoute, import.meta.env.PUBLIC_API_URL);

      return fetch(api, { credentials: "include" })
        .then((res) => res.json())
        .catch((error) => {
          throw new Error(error);
        });
    },
    staleTime,
  });

  if (isPending) {
    return (
      <div>
        <p>loading...</p>
      </div>
    );
  }

  if (error) {
    return <pre>{JSON.stringify(error, null, 2)}</pre>;
  }

  return (
    <>
      <Header heading={heading} />

      {children ? (
        children({ data, isPending, error })
      ) : (
        <div>
          <details>
            <summary>Debug info:</summary>
            <pre>{JSON.stringify(data, null, 2)}</pre>
          </details>
        </div>
      )}
    </>
  );
};

export const Home = () => {
  return (
    <PageWithQuery heading="Ideas" apiRoute="/api/ideas" staleTime={1000 * 60}>
      {({ data }) => {
        if (data.message) {
          return (
            <div>
              <p>{data.message}</p>
            </div>
          );
        }

        return (
          <ul className={styles.ideas}>
            {data.map((idea: Idea) => (
              <Idea key={idea.id} {...idea} />
            ))}
          </ul>
        );
      }}
    </PageWithQuery>
  );
};

export const AddIdea = ({ member }: { member: Member | null }) => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const api = new URL("/api/idea", import.meta.env.PUBLIC_API_URL);
  const addIdea = useMutation({
    mutationFn: ({ text }: { text: string }) => {
      const data = new URLSearchParams();
      data.append("text", text);

      return fetch(api, {
        method: "post",
        body: data,
        credentials: "include",
      }).then((res) => res.json());
    },
    onSuccess: async (newIdea) => {
      await queryClient.cancelQueries({ queryKey: ["/api/ideas"] });

      queryClient.setQueryData(["/api/ideas"], (old: Idea[]) => [
        ...old,
        { ...newIdea, creator: member?.name },
      ]);
    },
    onSettled: async () => {
      navigate("/dashboard");
    },
  });

  return (
    <>
      <Header heading="Add an idea" />
      <div>
        <form
          action={api.toString()}
          method="POST"
          onSubmit={(e) => {
            e.preventDefault();

            const data = new FormData(e.currentTarget);
            const text = data.get("text") as string;

            if (!text) {
              console.log("oh no");
              return;
            }

            addIdea.mutate({ text });
          }}
        >
          <label htmlFor="text">Idea</label>
          <input id="text" name="text" type="text" required />

          <button type="submit">Add Idea</button>
        </form>
      </div>
    </>
  );
};

export const Account = () => {
  return (
    <PageWithQuery heading="Account Settings" apiRoute="/api/account">
      {({ data }) => {
        return (
          <div>
            <form
              action={new URL(
                "/api/account",
                import.meta.env.PUBLIC_API_URL,
              ).toString()}
              method="POST"
            >
              <label htmlFor="name">Display Name</label>
              <input
                type="text"
                name="name"
                id="name"
                defaultValue={data.name ?? ""}
              />

              <button type="submit">Update Display Name</button>
            </form>

            <details>
              <summary>Debug info:</summary>
              <p>
                Account settings are loaded from{" "}
                <a href="https://stytch.com/docs/b2b/api/get-member">
                  https://stytch.com/docs/b2b/api/get-member
                </a>
              </p>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </details>
          </div>
        );
      }}
    </PageWithQuery>
  );
};

export const TeamMembers = ({
  isAuthorizedToInvite,
  isAdmin,
  updateMemberRole,
  inviteNewMember,
}: {
  isAuthorizedToInvite: boolean;
  isAdmin: boolean;
  updateMemberRole: (member: any) => Promise<any>;
  inviteNewMember: (email: string) => Promise<any>;
}) => {
  const queryClient = useQueryClient();
  const [pending, setPending] = useState<string>();
  const [inviteMessage, setInviteMessage] = useState<string>();

  return (
    <PageWithQuery
      heading="Team Members"
      apiRoute="/api/team"
      staleTime={1000 * 60}
    >
      {({ data }) => {
        if (data.message === "Unauthorized") {
          return (
            <div>
              <p>You don’t have permission to see this information.</p>
            </div>
          );
        }

        return (
          <div className={styles.teamMembers}>
            <ul>
              {data.members.map((member: any) => {
                const isMemberAdmin = member.roles.some(
                  (role: { role_id: string }) =>
                    role.role_id === "stytch_admin",
                );
                let buttonText = isMemberAdmin
                  ? "revoke admin role"
                  : "grant admin role";

                if (pending === member.id) {
                  buttonText = "updating...";
                }

                return (
                  <li key={member.id}>
                    {member.name} ({member.email})
                    <span
                      className={styles.memberStatus}
                      data-status={member.status}
                    >
                      {member.status}
                    </span>
                    <span className={styles.memberRoles}>
                      {member.roles.map((role: any) => role.role_id).join(", ")}
                    </span>
                    {isAdmin ? (
                      <button
                        onClick={async (event) => {
                          event.preventDefault();
                          setPending(member.id);

                          await updateMemberRole(member);

                          await queryClient.invalidateQueries({
                            queryKey: ["/api/team"],
                          });

                          setPending(undefined);
                        }}
                      >
                        {buttonText}
                      </button>
                    ) : null}
                  </li>
                );
              })}
            </ul>

            {inviteMessage ? (
              <div className={styles.inviteMessage}>
                <p>{inviteMessage}</p>
              </div>
            ) : null}

            {data.meta.invites_allowed && isAuthorizedToInvite ? (
              <>
                <h2>Invite a new team member</h2>
                <form
                  onSubmit={async (event) => {
                    event.preventDefault();

                    const formData = new FormData(event.currentTarget);
                    const email = formData.get("email") as string;

                    await inviteNewMember(email);

                    setInviteMessage(`Invite sent to ${email}`);
                    queryClient.invalidateQueries({
                      queryKey: ["/api/team"],
                    });
                  }}
                >
                  <label htmlFor="email">Email</label>
                  <input type="email" name="email" id="email" required />

                  <button type="submit">Invite</button>
                </form>
              </>
            ) : null}

            <details>
              <summary>Debug info:</summary>
              <p>
                Team members are loaded from{" "}
                <a href="https://stytch.com/docs/b2b/api/search-members">
                  https://stytch.com/docs/b2b/api/search-members
                </a>
              </p>
              <pre>{JSON.stringify(data, null, 2)}</pre>
            </details>
          </div>
        );
      }}
    </PageWithQuery>
  );
};

export const TeamSettings = ({
  isAuthorized,
}: {
  isAuthorized: {
    invites: boolean;
    jit: boolean;
    allowedDomains: boolean;
    allowedAuthMethods: boolean;
  };
}) => {
  const api = new URL("/api/team-settings", import.meta.env.PUBLIC_API_URL);
  const isAuthorizedForAnySetting =
    isAuthorized.jit ||
    isAuthorized.invites ||
    isAuthorized.allowedDomains ||
    isAuthorized.allowedAuthMethods;

  return (
    <>
      <PageWithQuery heading="Team Settings" apiRoute="/api/team-settings">
        {({ data }) => {
          return (
            <div>
              <form action={api.toString()} method="POST">
                <label htmlFor="invites">
                  <input
                    type="checkbox"
                    name="email_invites"
                    id="invites"
                    defaultChecked={data.email_invites === "ALL_ALLOWED"}
                    disabled={!isAuthorized.invites}
                  />
                  Allow all team members to invite new members
                </label>

                <label htmlFor="jit">
                  <input
                    type="checkbox"
                    name="email_jit_provisioning"
                    id="jit"
                    defaultChecked={
                      data.email_jit_provisioning === "RESTRICTED"
                    }
                    disabled={!isAuthorized.jit}
                  />
                  Allow JIT provisioning for allowed email domains
                </label>

                <label htmlFor="allowed_domains">
                  Allowed domains for invites
                </label>
                <input
                  type="text"
                  name="email_allowed_domains"
                  id="allowed_domains"
                  defaultValue={data.email_allowed_domains?.join(", ") ?? ""}
                  disabled={!isAuthorized.allowedDomains}
                />

                <fieldset>
                  <legend>
                    Allow team members to sign in with the following auth
                    methods:
                  </legend>

                  {[
                    { name: "sso", label: "SSO" },
                    { name: "magic_link", label: "Magic Link" },
                    { name: "password", label: "Password" },
                    { name: "google_oauth", label: "Google OAuth" },
                    { name: "microsoft_oauth", label: "Microsoft OAuth" },
                  ].map(({ name, label }) => (
                    <label key={`auth_method_${name}`} htmlFor={name}>
                      <input
                        type="checkbox"
                        name="allowed_auth_methods"
                        id={name}
                        value={name}
                        defaultChecked={
                          data.auth_methods === "ALL_ALLOWED" ||
                          data.allowed_auth_methods.includes(name)
                        }
                        disabled={!isAuthorized.allowedAuthMethods}
                      />
                      {label}
                    </label>
                  ))}
                </fieldset>

                {isAuthorizedForAnySetting ? (
                  <button type="submit">Update Team Settings</button>
                ) : null}
              </form>

              <details>
                <summary>Debug info:</summary>
                <p>
                  Organization settings are loaded from{" "}
                  <a href="https://stytch.com/docs/b2b/api/org-auth-settings">
                    https://stytch.com/docs/b2b/api/org-auth-settings
                  </a>
                </p>
                <pre>{JSON.stringify(data, null, 2)}</pre>
              </details>
            </div>
          );
        }}
      </PageWithQuery>
    </>
  );
};
