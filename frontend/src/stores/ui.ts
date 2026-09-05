import {create} from 'zustand';import type {Role} from '../types';
type UI={role:Role;townId:string;offlineTest:boolean;setRole:(r:Role)=>void;setTown:(t:string)=>void;setOfflineTest:(v:boolean)=>void};
export const useUI=create<UI>(set=>({role:'CREW_CHIEF',townId:'mangalparthy',offlineTest:false,setRole:role=>set({role}),setTown:townId=>set({townId}),setOfflineTest:offlineTest=>set({offlineTest})}));
