
"use client";

import { MessageSimple, useChatContext, useMessageContext } from 'stream-chat-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { ChevronDown, Trash, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Italic } from 'lucide-react';

interface CustomMessageProps {
    deletedMessages: string[];
    [key: string]: any;
}

export const CustomMessage = (props: CustomMessageProps) => {
    const { message, groupedByUser } = useMessageContext();
    const { client } = useChatContext();
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const isMyMessage = message.user?.id === client.userID;

    if (props.deletedMessages.includes(message.id)) {
        return null; // Don't render the message if it's soft-deleted
    }

    const deleteForMe = async () => {
        try {
            await client.flagMessage(message.id);
        } catch (error) {
            // Error deleting message
        }
    };

    const deleteForEveryone = async () => {
        try {
            await client.deleteMessage(message.id);
        } catch (error) {
            // Error deleting message
        }
    };

    const isDeleted = !!message.deleted_at;

    return (
        <div className={cn("relative group", isDeleted ? 'opacity-50' : '')}>
            <MessageSimple
                {...props}
                message={{
                    ...message,
                    text: isDeleted ? "This message was deleted" : message.text,
                    html: isDeleted ? `<p><i>This message was deleted</i></p>` : message.html
                }}
            />
            {!isDeleted && isMyMessage && (
                <div className={cn(
                    "absolute top-0 opacity-0 group-hover:opacity-100 transition-opacity",
                    isMyMessage ? "left-0 -translate-x-full pr-2" : "right-0 translate-x-full pl-2",
                )}>
                    <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                        <DropdownMenuTrigger asChild>
                            <button className="p-1 rounded-full hover:bg-black/10 dark:hover:bg-white/10">
                                <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent>
                            <DropdownMenuItem onClick={deleteForMe}>
                                <Trash className="mr-2 h-4 w-4" /> Delete for me
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={deleteForEveryone}>
                                <Users className="mr-2 h-4 w-4" /> Delete for everyone
                            </DropdownMenuItem>
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
            )}
        </div>
    );
};
