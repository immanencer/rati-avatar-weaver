import { Avatar as AvatarType } from "@/lib/types";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { ExternalLink, Loader2, AlertCircle } from "lucide-react";
import { Avatar as AvatarComponent, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

interface Avatar {
  _id: string;
  name: string;
  emoji: string;
  personality: string;
  description: string;
  imageUrl?: string;
  uploadStatus?: 'pending' | 'uploading' | 'completed' | 'failed';
  uploadError?: string | null;
  arweaveUrl?: string | null;
  arweaveMetadataUrl?: string | null;
}

interface AvatarCardProps {
  avatar: Avatar;
}

export function AvatarCard({ avatar }: AvatarCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const weaveAvatarMutation = useMutation({
    mutationFn: async () => {
      try {
        const response = await fetch(`/api/avatars/${avatar._id}/weave`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) {
          throw new Error(await response.text());
        }

        return await response.json();
      } catch (error) {
        console.error('Publishing error:', error);
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avatars"] });
      toast({
        title: "Publishing Started",
        description: "Your avatar is being published to Arweave...",
      });
    },
    onError: (error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to publish avatar",
      });
    },
  });

  const getUploadStatusBadge = () => {
    switch (avatar.uploadStatus) {
      case 'pending':
        return <Badge variant="secondary">Pending Upload</Badge>;
      case 'uploading':
        return (
          <Badge variant="secondary" className="flex items-center gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            Uploading
          </Badge>
        );
      case 'completed':
        return <Badge variant="default">Published</Badge>;
      case 'failed':
        return <Badge variant="destructive">Upload Failed</Badge>;
      default:
        return null;
    }
  };

  const handlePublish = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await weaveAvatarMutation.mutateAsync();
    } catch (error) {
      console.error('Publishing error:', error);
    }
  };

  return (
    <Card 
      className={cn(
        "w-full transition-all duration-200 ease-in-out cursor-pointer relative",
        isExpanded ? "transform-none" : "hover:scale-[1.02]"
      )}
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center space-x-4">
          <AvatarComponent className="h-16 w-16">
            <AvatarImage src={avatar.imageUrl || ''} alt={avatar.name} />
            <AvatarFallback className="text-2xl">{avatar.emoji}</AvatarFallback>
          </AvatarComponent>
          <div>
            <h2 className="text-2xl font-bold">{avatar.name}</h2>
            {!isExpanded && (
              <p className="text-sm text-gray-500 line-clamp-1">{avatar.personality}</p>
            )}
          </div>
        </div>
        <div className="flex flex-col items-end gap-2">
          <div className="flex items-center gap-2">
            {getUploadStatusBadge()}
            {!avatar.arweaveUrl && avatar.uploadStatus !== 'pending' && avatar.uploadStatus !== 'uploading' && (
              <Button
                variant="outline"
                size="sm"
                onClick={handlePublish}
                disabled={weaveAvatarMutation.isPending}
              >
                {weaveAvatarMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Publishing...
                  </>
                ) : (
                  'Publish'
                )}
              </Button>
            )}
          </div>
          {isExpanded ? (
            <ChevronUp className="w-5 h-5 text-gray-400" />
          ) : (
            <ChevronDown className="w-5 h-5 text-gray-400" />
          )}
        </div>
      </CardHeader>

      {isExpanded && (
        <CardContent>
          <p className="text-sm text-gray-500 mt-1">{avatar.personality}</p>
          <p className="mt-4">{avatar.description}</p>

          <div className="mt-4 space-y-2">
            {avatar.uploadStatus === 'failed' && avatar.uploadError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{avatar.uploadError}</AlertDescription>
              </Alert>
            )}

            {avatar.arweaveUrl && (
              <div className="flex items-center gap-2">
                <a
                  href={avatar.arweaveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  View on Arweave <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}

            {avatar.arweaveMetadataUrl && (
              <div className="flex items-center gap-2">
                <a
                  href={avatar.arweaveMetadataUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  onClick={(e) => e.stopPropagation()}
                >
                  View Metadata <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}