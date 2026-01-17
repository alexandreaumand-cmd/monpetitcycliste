import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";
import mpcLogo from "@/assets/mpc-logo.png";

const Auth = () => {
  const { t } = useTranslation('auth');
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nom, setNom] = useState("");
  const [sponsor, setSponsor] = useState("");
  
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
            <img src={mpcLogo} alt="Mon Petit Cycliste" className="h-32 w-32 object-contain" />
          </div>
          {inviteToken ? (
            <CardDescription className="text-primary font-medium">
              🎉 {t('messages.inviteWelcome')}
              <br />
              <span className="text-sm text-muted-foreground">{t('messages.createAccountAndJoin')}</span>
            </CardDescription>
          ) : (
            <CardDescription>
              {t('messages.loginSuccess')}
            </CardDescription>
          )}
        </CardHeader>
        <CardContent>
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
