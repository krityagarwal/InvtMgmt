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
    // 1. Get the hash directly from the window
    const hash = window.location.hash;
    
    // 2. Log it to your console to debug (Remove this after it works)
    console.log("Current URL Hash:", hash);
    // DEBUG: Check if the client is actually initialized
    console.log("Supabase URL:", import.meta.env.VITE_SUPABASE_URL);
    console.log("Attempting login for:", email);

    // 3. Check for the keywords Supabase sends
    if (hash && (hash.includes('type=invite') || hash.includes('type=recovery') || hash.includes('type=signup'))) {
        setIsNewUser(true);
    }
  }, []);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Now this ONLY runs when you click 'Sign In'
    console.log("--- Login Attempt Start ---");
    console.log("Connecting to:", import.meta.env.VITE_SUPABASE_URL);
    console.log("User Email:", email);

    const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password,
    });

    if (error) {
        console.error("Login Result: FAILED", error.message);
        alert(error.message);
    } else {
        console.log("Login Result: SUCCESS", data.user?.id);
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