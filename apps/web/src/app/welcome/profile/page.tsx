import { redirect } from "next/navigation";

import { AuthShell } from "@/components/auth-shell";
import { ProfileEditorForm } from "@/components/profile-editor-form";
import { requireCurrentAuthSession } from "@/lib/auth-server";
import { getMe } from "@/lib/server-api";

export default async function WelcomeProfilePage() {
  await requireCurrentAuthSession("/welcome/profile");
  const me = await getMe({ allowIncompleteProfile: true });

  if (me.user.name.trim().length > 0) {
    redirect("/");
  }

  return (
    <AuthShell
      title="Finish your profile"
      subtitle="Set the name teammates will see before you create or join workspaces. You can upload a profile image now or come back later in settings."
      aside={(
        <div className="space-y-4 text-sm leading-6 text-muted-foreground">
          <div>
            Email sign-in gets you through verification quickly, then we ask for the human details that make mentions and assignees readable.
          </div>
          <div>
            Your mention handle starts from the email you signed in with, and you can adjust it here before entering the app.
          </div>
        </div>
      )}
    >
      <ProfileEditorForm
        title="Complete your profile"
        description="Add the name your team should see in comments, assignments, and workspace member lists."
        redirectToOnSave="/"
        submitLabel="Continue to Wevlo"
        submitNote="You can always revisit settings later to refine your profile image and mention handle."
        successMessage="Profile saved. Redirecting to your workspace."
        user={me.user}
      />
    </AuthShell>
  );
}
