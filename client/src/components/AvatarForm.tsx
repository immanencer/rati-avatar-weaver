import { useForm } from "react-hook-form";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useMutation, useQueryClient } from "@tanstack/react-query";

interface AvatarFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingAvatar?: Avatar;
}

interface Avatar {
  _id: string;
  name: string;
  emoji: string;
  personality: string;
  description: string;
  imageUrl?: string;
  lives: number;
  status: string;
}

interface AvatarFormData {
  name: string;
  emoji: string;
  personality: string;
  description: string;
  imageFile?: File;
}

export function AvatarForm({ open, onOpenChange, editingAvatar }: AvatarFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const form = useForm<AvatarFormData>({
    defaultValues: editingAvatar ? {
      name: editingAvatar.name,
      emoji: editingAvatar.emoji,
      personality: editingAvatar.personality,
      description: editingAvatar.description,
    } : {
      name: "",
      emoji: "",
      personality: "",
      description: "",
    },
  });

  const mutation = useMutation({
    mutationFn: async (data: AvatarFormData) => {
      const formData = new FormData();
      formData.append('name', data.name);
      formData.append('emoji', data.emoji);
      formData.append('personality', data.personality);
      formData.append('description', data.description);
      if (data.imageFile) {
        formData.append('image', data.imageFile);
      }

      const url = editingAvatar 
        ? `/api/avatars/${editingAvatar._id}`
        : "/api/avatars";

      const response = await fetch(url, {
        method: editingAvatar ? "PUT" : "POST",
        body: formData,
      });

      if (!response.ok) {
        throw new Error("Failed to save avatar");
      }

      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/avatars"] });
      onOpenChange(false);
      form.reset();
      toast({
        title: `Avatar ${editingAvatar ? "updated" : "created"}`,
        description: `The avatar has been successfully ${editingAvatar ? "updated" : "created"}.`,
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save avatar",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: AvatarFormData) => {
    mutation.mutate(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>
            {editingAvatar ? "Edit Avatar" : "Create New Avatar"}
          </DialogTitle>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter avatar name" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="emoji"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Emoji</FormLabel>
                  <FormControl>
                    <Input {...field} placeholder="Enter emoji" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="imageFile"
              render={() => (
                <FormItem>
                  <FormLabel>Image</FormLabel>
                  <FormControl>
                    <Input 
                      type="file" 
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          form.setValue('imageFile', file);
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="personality"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Personality</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Describe avatar's personality"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Enter avatar description"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end space-x-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={mutation.isPending}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={mutation.isPending}>
                {mutation.isPending ? "Saving..." : editingAvatar ? "Update" : "Create"}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}