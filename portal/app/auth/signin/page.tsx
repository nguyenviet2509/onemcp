'use client';

// Custom signin page — hiện brand + button để user chủ động bấm đăng nhập.
// Trước đây là Route Handler auto-trigger signIn('zitadel') ngay lập tức nên
// người dùng bị đá qua Zitadel không kịp nhận biết. Đổi sang page với button
// theo pattern của Central RBAC (bấm "Đăng nhập qua Zitadel" mới redirect).

import { Suspense, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';

function SignInCard() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get('callbackUrl') ?? '/';
  const [loading, setLoading] = useState(false);

  const handleSignIn = () => {
    setLoading(true);
    // signIn dispatch CSRF → 302 tới Zitadel authorize. setLoading để tránh
    // double-click; button unmount khi browser navigate nên không cần reset.
    void signIn('zitadel', { callbackUrl });
  };

  return (
    <div className="w-full max-w-md rounded-lg border border-border bg-card p-8 shadow-sm">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-foreground">OneMCP</h1>
        <p className="mt-2 text-sm text-muted-foreground">Cổng tri thức nội bộ</p>
      </div>
      <div className="mt-8">
        <Button
          type="button"
          size="lg"
          className="w-full"
          onClick={handleSignIn}
          disabled={loading}
        >
          {loading ? 'Đang chuyển sang Zitadel…' : 'Đăng nhập qua Zitadel'}
        </Button>
      </div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <div className="grid min-h-screen place-items-center bg-background p-4">
      <Suspense>
        <SignInCard />
      </Suspense>
    </div>
  );
}
