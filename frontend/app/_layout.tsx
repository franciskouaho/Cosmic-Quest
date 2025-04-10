import { Stack, usePathname, useRouter } from "expo-router";
import { useEffect } from "react";

export default function RootLayout() {
  const router = useRouter();
  const pathname = usePathname();
  
  useEffect(() => {
    // Rediriger vers /splash si on est à la racine
    if (pathname === "/") {
      router.replace("/splash");
    }
  }, [pathname]);

  // Ajouter screenOptions pour masquer les en-têtes de navigation
  return <Stack screenOptions={{ headerShown: false }} />;
}

