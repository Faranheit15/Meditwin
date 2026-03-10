import { SignIn } from "@clerk/nextjs";

import { ROUTES } from "@/constants/routes";

export default function SignInPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="glass-panel rounded-[2rem] p-4 shadow-[0_30px_120px_rgba(0,0,0,0.35)]">
        <SignIn forceRedirectUrl={ROUTES.PROTOCOLS} fallbackRedirectUrl={ROUTES.PROTOCOLS} />
      </div>
    </main>
  );
}
