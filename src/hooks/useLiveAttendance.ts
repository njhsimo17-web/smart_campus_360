import { useEffect,useState } from 'react';
import { collection,limit,onSnapshot,orderBy,query,Timestamp } from 'firebase/firestore';
import { db } from '../firebase';

export interface LiveAttendanceRecord {id:string;studentUid:string;studentApogee:string;studentName:string;department:string;program:string;level:string;rfidUID:string;event:string;room:string;deviceId:string;createdAt?:Timestamp;}

export function useLiveAttendance(){
  const [records,setRecords]=useState<LiveAttendanceRecord[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(false);
  useEffect(()=>{const attendanceQuery=query(collection(db,'attendance'),orderBy('createdAt','desc'),limit(100));const unsubscribe=onSnapshot(attendanceQuery,snapshot=>{setRecords(snapshot.docs.map(item=>{const data=item.data();return{id:item.id,studentUid:String(data.studentUid||''),studentApogee:String(data.studentApogee||''),studentName:String(data.studentName||''),department:String(data.department||''),program:String(data.program||''),level:String(data.level||''),rfidUID:String(data.rfidUID||''),event:String(data.event||''),room:String(data.room||''),deviceId:String(data.deviceId||''),createdAt:data.createdAt instanceof Timestamp?data.createdAt:undefined};}));setLoading(false);setError(false);},listenerError=>{console.error('Attendance listener error:',listenerError);setError(true);setLoading(false);});return()=>unsubscribe();},[]);
  return{records,loading,error};
}
