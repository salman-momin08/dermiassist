
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


export async function getVerifiedDoctorsBySpecialization(specialization: string) {
    const doctorsRef = collection(db, "users");
    const q = query(
        doctorsRef, 
        where("role", "==", "doctor"),
        where("verified", "==", true),
        where("specialization", "==", specialization)
    );

    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        return [];
    }

    return querySnapshot.docs.map(doc => {
        const data = doc.data();
        return {
            id: doc.id,
            name: data.displayName || "Dr. Anonymous",
            specialization: data.specialization || "N/A",
            location: data.location || "N/A",
            avatar: data.photoURL || `https://placehold.co/100x100.png?text=${(data.displayName || 'D').charAt(0)}`,
        };
    });
}
