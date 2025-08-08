
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { MapPin, ShieldCheck, Star } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

const doctors = [
    {
        name: "Dr. Emily Carter",
        avatar: "https://placehold.co/100x100.png",
        specialization: "General Dermatology",
        location: "New York, NY",
        rating: 4.9,
        reviews: 124,
        verified: true,
    },
    {
        name: "Dr. Ben Adams",
        avatar: "https://placehold.co/100x100.png",
        specialization: "Pediatric Dermatology",
        location: "Los Angeles, CA",
        rating: 4.8,
        reviews: 89,
        verified: true,
    },
    {
        name: "Dr. Olivia Chen",
        avatar: "https://placehold.co/100x100.png",
        specialization: "Cosmetic Dermatology",
        location: "Chicago, IL",
        rating: 5.0,
        reviews: 210,
        verified: true,
    },
    {
        name: "Dr. Marcus Rodriguez",
        avatar: "https://placehold.co/100x100.png",
        specialization: "Dermatopathology",
        location: "Houston, TX",
        rating: 4.7,
        reviews: 65,
        verified: false,
    },
];

const analyses = [
    { id: '1', condition: 'Acne Vulgaris', date: '2024-05-15' },
    { id: '2', condition: 'Eczema', date: '2024-04-22' },
    { id: '3', condition: 'Rosacea', date: '2024-03-10' },
];

export default function DoctorsPage() {
    return (
        <div className="container mx-auto p-4 md:p-8">
            <div className="flex flex-col items-center justify-center space-y-2 mb-8 text-center">
                <h1 className="text-3xl font-bold tracking-tight font-headline">
                    Find a Certified Doctor
                </h1>
                <p className="text-muted-foreground max-w-2xl">
                    Browse our network of professional dermatologists and book an appointment. Attach your AI report for a more informed consultation.
                </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {doctors.map((doctor) => (
                    <Card key={doctor.name} className="flex flex-col">
                        <CardHeader className="items-center text-center">
                            <Avatar className="w-24 h-24 mb-4">
                                <AvatarImage src={doctor.avatar} alt={doctor.name} data-ai-hint="doctor portrait" />
                                <AvatarFallback>{doctor.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <CardTitle className="flex items-center gap-2">
                                {doctor.name}
                                {doctor.verified && <ShieldCheck className="h-5 w-5 text-primary" />}
                            </CardTitle>
                            <CardDescription>{doctor.specialization}</CardDescription>
                        </CardHeader>
                        <CardContent className="flex-grow">
                            <div className="flex justify-between items-center text-sm text-muted-foreground border-t pt-4">
                                <div className="flex items-center gap-1">
                                    <MapPin className="h-4 w-4" />
                                    {doctor.location}
                                </div>
                                <div className="flex items-center gap-1">
                                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                                    {doctor.rating} ({doctor.reviews})
                                </div>
                            </div>
                        </CardContent>
                        <CardFooter>
                            <Dialog>
                                <DialogTrigger asChild>
                                    <Button className="w-full">Request Appointment</Button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[480px]">
                                    <DialogHeader>
                                        <DialogTitle>Request Appointment with {doctor.name}</DialogTitle>
                                        <DialogDescription>
                                            Please fill out the details below to request your appointment.
                                        </DialogDescription>
                                    </DialogHeader>
                                    <div className="grid gap-4 py-4">
                                        <div className="space-y-2">
                                            <Label>Appointment Mode</Label>
                                            <RadioGroup defaultValue="online" className="flex gap-4">
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="online" id="online" />
                                                    <Label htmlFor="online">Online</Label>
                                                </div>
                                                <div className="flex items-center space-x-2">
                                                    <RadioGroupItem value="offline" id="offline" />
                                                    <Label htmlFor="offline">Offline</Label>
                                                </div>
                                            </RadioGroup>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="report">Attach AI Report (Optional)</Label>
                                            <Select>
                                                <SelectTrigger>
                                                    <SelectValue placeholder="Select a report to attach" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {analyses.map(a => (
                                                        <SelectItem key={a.id} value={a.id}>
                                                            {a.condition} - {a.date}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <div className="space-y-2">
                                            <Label htmlFor="notes">Additional Notes</Label>
                                            <Textarea id="notes" placeholder="Tell the doctor anything else you'd like them to know." />
                                        </div>
                                    </div>
                                    <DialogFooter>
                                        <Button type="submit">Send Request</Button>
                                    </DialogFooter>
                                </DialogContent>
                            </Dialog>
                        </CardFooter>
                    </Card>
                ))}
            </div>
        </div>
    );
}
