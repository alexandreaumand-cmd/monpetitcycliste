import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import logoCarreTexte from "@/assets/logo-carre-texte.png";

const Auth = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [sponsor, setSponsor] = useState("");
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  
  const searchParams = new URLSearchParams(window.location.search);
  const nextUrl = searchParams.get('next') || '/dashboard/home';
  const defaultTab = searchParams.get('tab') as 'signin' | 'signup' | null;
  
  // Extract token from next URL if it's a join link
  const inviteToken = nextUrl.includes('/join?token=') 
    ? nextUrl.split('token=')[1]?.split('&')[0] 
    : null;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate(nextUrl);
      }
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session) {
        // Check if manager profile exists
        const { data: manager } = await supabase
          .from('managers')
          .select('id')
          .eq('user_id', session.user.id)
          .maybeSingle();

        // If no manager profile, redirect to complete profile
        if (!manager && !inviteToken) {
          navigate(`/complete-profile?next=${encodeURIComponent(nextUrl)}`);
          return;
        }

        // If coming from invite, handle join process
        if (inviteToken) {
          try {
            console.log('Attempting to join league with token:', inviteToken.slice(0, 8) + '...');
            
            // Wait for manager to be created (retry up to 6 times with 500ms delay)
            let managerExists = false;
            for (let i = 0; i < 6; i++) {
              const { data: manager } = await supabase
                .from('managers')
                .select('id')
                .eq('user_id', session.user.id)
                .maybeSingle();
              
              if (manager) {
                managerExists = true;
                console.log('Manager found after', i + 1, 'attempt(s)');
                break;
              }
              console.log('Manager not found yet, attempt', i + 1, '/ 6');
              await new Promise(r => setTimeout(r, 500));
            }
            
            if (!managerExists) {
              console.warn('Manager not created in time, proceeding anyway');
            }
            
            const { data, error } = await supabase.functions.invoke('leagues-join-by-token', {
              body: { token: inviteToken },
            });

            if (error) {
              console.error('Join league error:', error);
              toast({
                title: t('errors.generic'),
                description: t('errors.generic'),
                variant: "destructive",
              });
              navigate(`/invite?token=${inviteToken}`);
              return;
            }

            if (data?.ok) {
              toast({
                title: t('messages.loginSuccess'),
                description: `${t('messages.loginSuccess')} "${data.league_name}"`,
              });
              navigate(`/?leagueId=${data.league_id}`);
              return;
            } else {
              console.error('Join league failed:', data);
              navigate(`/invite?token=${inviteToken}`);
              return;
            }
          } catch (err) {
            console.error('Auto-join exception:', err);
            toast({
              title: t('errors.generic'),
              description: t('errors.generic'),
              variant: "destructive",
            });
            navigate(`/invite?token=${inviteToken}`);
          }
          return;
        }
        navigate(nextUrl);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate, nextUrl, inviteToken, t]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}${nextUrl}`,
        },
      });

      if (authError) throw authError;

      if (authData.user) {
        const { error: managerError } = await supabase
          .from("managers")
          .insert({
            user_id: authData.user.id,
            nom,
            sponsor,
            email,
          });

        if (managerError) throw managerError;
        
        toast({
          title: t('messages.registerSuccess'),
          description: t('messages.registerSuccess'),
        });
      }
    } catch (error: any) {
      toast({
        title: t('errors.generic'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;
    } catch (error: any) {
      toast({
        title: t('errors.invalidCredentials'),
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-muted/30 to-background p-4">
      <Card className="w-full max-w-md shadow-elegant">
        <CardHeader className="text-center space-y-4">
          <div className="flex justify-center">
            <img src={logoCarreTexte} alt="La Bordure Fantasy Cycling" className="h-40 w-auto object-contain" />
          </div>
          {inviteToken && (
            <CardDescription className="text-primary font-medium">
              🎉 {t('messages.inviteWelcome')}
              <br />
              <span className="text-sm text-muted-foreground">{t('messages.createAccountAndJoin')}</span>
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-4">
            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={async () => {
                const { error } = await lovable.auth.signInWithOAuth("google", {
                  redirect_uri: window.location.origin,
                });
                if (error) {
                  toast({
                    title: t('errors.generic'),
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              {t('buttons.googleSignIn', 'Continuer avec Google')}
            </Button>

            <Button
              type="button"
              variant="outline"
              className="w-full flex items-center justify-center gap-2"
              onClick={async () => {
                const { error } = await lovable.auth.signInWithOAuth("apple", {
                  redirect_uri: window.location.origin,
                });
                if (error) {
                  toast({
                    title: t('errors.generic'),
                    description: error.message,
                    variant: "destructive",
                  });
                }
              }}
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
              {t('buttons.appleSignIn', 'Continuer avec Apple')}
            </Button>
          </div>

          <div className="relative mb-4">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">ou</span>
            </div>
          </div>

          <Tabs defaultValue={defaultTab || (inviteToken ? "signup" : "signin")} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t('tabs.signin')}</TabsTrigger>
              <TabsTrigger value="signup">{t('tabs.signup')}</TabsTrigger>
            </TabsList>
            
            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email">{t('labels.email')}</Label>
                  <Input
                    id="signin-email"
                    type="email"
                    placeholder={t('placeholders.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signin-password">{t('labels.password')}</Label>
                  <Input
                    id="signin-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full gradient-primary text-white hover:opacity-90"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? t('buttons.loggingIn') : t('buttons.login')}
                </Button>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signup-nom">{t('labels.managerName')}</Label>
                  <Input
                    id="signup-nom"
                    type="text"
                    placeholder={t('placeholders.managerName')}
                    value={nom}
                    onChange={(e) => setNom(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-sponsor">{t('labels.sponsor')}</Label>
                  <Input
                    id="signup-sponsor"
                    type="text"
                    placeholder={t('placeholders.sponsor')}
                    value={sponsor}
                    onChange={(e) => setSponsor(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-email">{t('labels.email')}</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder={t('placeholders.email')}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="signup-password">{t('labels.password')}</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                </div>
                <Button 
                  type="submit" 
                  className="w-full gradient-primary text-white hover:opacity-90"
                  disabled={loading}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {loading ? t('buttons.registering') : t('buttons.register')}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
};

export default Auth;
