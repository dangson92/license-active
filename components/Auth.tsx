import React, { useState } from 'react';
import { UserRole } from '../types';
import { ShieldCheckIcon, LockIcon, MailIcon, UsersIcon } from './Icons';

interface AuthProps {
  onLogin: (username: string, role: UserRole) => void;
  onRegister: (username: string, role: UserRole) => void;
}

export const Auth: React.FC<AuthProps> = ({ onLogin, onRegister }) => {
  const [isLogin, setIsLogin] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState(''); // Visual only for this demo
  const [role, setRole] = useState<UserRole>(UserRole.USER);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) return;
    
    if (isLogin) {
      onLogin(username, role); // In a real app, role would come from DB after auth
    } else {
      onRegister(username, role);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-100">
        <div className="bg-indigo-600 p-8 text-center">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ShieldCheckIcon className="text-white w-8 h-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">KeyMaster AI</h2>
            <p className="text-indigo-100 text-sm">Enterprise License Management</p>
        </div>

        <div className="p-8">
            <div className="flex justify-center mb-8">
                <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-medium">
                    <button 
                        onClick={() => setIsLogin(true)}
                        className={`px-4 py-2 rounded-md transition-all ${isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Login
                    </button>
                    <button 
                         onClick={() => setIsLogin(false)}
                         className={`px-4 py-2 rounded-md transition-all ${!isLogin ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Register
                    </button>
                </div>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Username</label>
                    <div className="relative">
                        <MailIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            placeholder="Enter username"
                            required
                        />
                    </div>
                </div>

                <div className="space-y-1">
                    <label className="text-xs font-semibold text-gray-500 uppercase">Password</label>
                    <div className="relative">
                        <LockIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition-all"
                            placeholder="••••••••"
                            required
                        />
                    </div>
                </div>

                {!isLogin && (
                    <div className="space-y-1">
                         <label className="text-xs font-semibold text-gray-500 uppercase">Account Type</label>
                         <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setRole(UserRole.USER)}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${role === UserRole.USER ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                            >
                                <span className="text-sm font-semibold">User</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setRole(UserRole.ADMIN)}
                                className={`flex flex-col items-center justify-center p-3 rounded-lg border-2 transition-all ${role === UserRole.ADMIN ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-gray-100 bg-gray-50 text-gray-500 hover:border-gray-200'}`}
                            >
                                <span className="text-sm font-semibold">Admin</span>
                            </button>
                         </div>
                    </div>
                )}
                 
                 {isLogin && (
                    // Simulate selecting a role for login since we don't have a real DB to lookup role by username yet
                    <div className="flex items-center justify-between text-xs text-gray-400 mt-2 px-1">
                        <span>Demo: Login as {role === UserRole.ADMIN ? 'Admin' : 'User'}</span>
                        <button type="button" onClick={() => setRole(role === UserRole.ADMIN ? UserRole.USER : UserRole.ADMIN)} className="text-indigo-600 hover:underline">
                            Switch Role
                        </button>
                    </div>
                 )}

                <button
                    type="submit"
                    className="w-full py-3 bg-gray-900 text-white rounded-xl font-bold text-sm hover:bg-black transition-all shadow-lg hover:shadow-xl mt-6"
                >
                    {isLogin ? 'Sign In' : 'Create Account'}
                </button>
            </form>
        </div>
      </div>
    </div>
  );
};
