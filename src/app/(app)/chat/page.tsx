
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MessageSquare } from "lucide-react";

export default function ChatPage() {
    return (
        <div className="container mx-auto p-4 md:p-8 flex flex-col items-center justify-center text-center">
            <div className="max-w-md">
                <Card>
                    <CardHeader>
                        <div className="mx-auto bg-primary/10 p-4 rounded-full w-fit mb-4">
                            <MessageSquare className="h-12 w-12 text-primary" />
                        </div>
                        <CardTitle className="font-headline text-2xl">
                            Doctor-Patient Chat
                        </CardTitle>
                        <CardDescription>
                           This feature is currently under construction. Soon, you'll be able to communicate directly with your doctors here.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button disabled>Start Chat</Button>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
