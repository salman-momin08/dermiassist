
'use server'

import { collection, getDocs, query, where, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import type { AnalysisReport } from "@/hooks/use-analyses";

export async function getAnalysesForUser(userId: string) {
    if (!userId) {
        throw new Error("User ID must be provided.");
    }
    
    const analysesRef = collection(db, 'users', userId, 'analyses');
    const q = query(analysesRef, orderBy('date', 'desc'));
    
    const querySnapshot = await getDocs(q);

    const reports = querySnapshot.docs.map(doc => ({
        id: doc.id,
        conditionName: doc.data().conditionName,
        date: doc.data().date,
    }));
    
    return reports;
}
