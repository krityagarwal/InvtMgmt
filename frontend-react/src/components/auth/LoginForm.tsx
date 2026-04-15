import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Label } from "@/components/ui/label";

export default function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isNewUser, setIsNewUser] = useState(false);

  // Check if the user reached this page via an invite link
  useEffect(() => {
    const hash = window.location.hash;
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery') || hash.includes('type=signup'))) {
      setIsNewUser(true);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isNewUser) {
        const { error } = await supabase.auth.updateUser({ password });
        if (error) throw error;
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) throw error;
      }
    } catch (error: any) {
      alert(error?.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

//   const handleAuth = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);

//     // If there is NO hash in the URL, this is a standard login
//     if (!isNewUser) {
//         const { data, error } = await supabase.auth.signInWithPassword({
//         email: email.trim(),
//         password: password,
//         });

//         if (error) {
//         alert(error.message); // Should now work once the URL is in .env
//         }
//     } else {
//         // This part only runs if you clicked an email link with a #hash
//         const { error } = await supabase.auth.updateUser({ password });
//         if (error) alert(error.message);
//     }
//     setLoading(false);
// };

//   const handleAuth = async (e: React.FormEvent) => {
//     e.preventDefault();
//     setLoading(true);

//     if (isNewUser) {
//       // Logic for Invited User setting their first password
//       const { error } = await supabase.auth.updateUser({ password });
//       if (error) alert(error.message);
//       else window.location.href = '/inventory';
//     } else {
//       // Standard Login Logic
//       const { error } = await supabase.auth.signInWithPassword({ email, password });
//       if (error) alert("Invalid login credentials");
//     }
//     setLoading(false);
//   };

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl font-bold text-center">
            {isNewUser ? 'Setup Your Account' : 'TLC Inventory Login'}
          </CardTitle>
          <CardDescription className="text-center">
            {isNewUser ? 'Please set a password to access the system' : 'Enter your credentials to manage stock'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleAuth} className="space-y-4">
            {!isNewUser && (
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="name@example.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required 
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input 
                id="password" 
                type="password" 
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required 
              />
            </div>
            <Button className="w-full bg-blue-600 hover:bg-blue-700" type="submit" disabled={loading}>
              {loading ? 'Processing...' : (isNewUser ? 'Set Password' : 'Sign In')}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
