"use client";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  EmailConnectionFormValues,
  emailConnectionSchema,
} from "@/lib/validations/email";
import { zodResolver } from "@hookform/resolvers/zod";
import { Eye, EyeOff, Mail } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

interface EmailConnectionFormProps {
  onSubmit: (values: EmailConnectionFormValues) => void;
  onTestConnection: (values: EmailConnectionFormValues) => Promise<boolean>;
  onInitiateOAuth: (provider: "google" | "microsoft") => void;
  isLoading?: boolean;
  initialData?: Partial<EmailConnectionFormValues>; // For editing
}

export function EmailConnectionForm({
  onSubmit,
  onTestConnection,
  onInitiateOAuth,
  isLoading = false,
  initialData = {},
}: EmailConnectionFormProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<
    "google" | "microsoft" | "manual"
  >("manual");

  const form = useForm<EmailConnectionFormValues>({
    resolver: zodResolver(emailConnectionSchema),
    defaultValues: {
      emailAddress: "",
      password: "",
      imapServer: "",
      imapPort: 993,
      smtpServer: "",
      smtpPort: 465,
      security: "SSL/TLS",
      accountName: "",
      ...initialData,
    },
  });

  const handleTestConnection = async () => {
    const values = form.getValues();
    // Trigger validation for all fields before testing
    const isValid = await form.trigger();
    if (!isValid) {
      toast.error(
        "Please fill in all required fields correctly before testing."
      );
      return;
    }

    setIsTestingConnection(true);
    try {
      const success = await onTestConnection(values);
      if (success) {
        toast.success("Connection successful!");
      } else {
        toast.error("Connection failed. Please check your settings.");
      }
    } catch (error) {
      toast.error(
        "Connection test failed: " +
          (error instanceof Error ? error.message : "Unknown error")
      );
    } finally {
      setIsTestingConnection(false);
    }
  };

  const submitHandler = (values: EmailConnectionFormValues) => {
    // If no account name is provided, use the email address as the account name
    if (!values.accountName || values.accountName.trim() === "") {
      values.accountName = values.emailAddress;
    }
    onSubmit(values);
  };

  const handleOAuthConnect = (provider: "google" | "microsoft") => {
    setSelectedProvider(provider);
    onInitiateOAuth(provider);
    // Optionally, you might want to clear or disable manual form fields here
    // if the user chooses an OAuth provider.
    // For now, we'll just set the provider and call the handler.
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>
          {initialData?.emailAddress
            ? "Edit Email Account"
            : "Connect New Email Account"}
        </CardTitle>
        <CardDescription>
          {initialData?.emailAddress
            ? "Update the details for your email account."
            : "Enter the details for your IMAP/SMTP email account or connect with a provider."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="mb-6 flex flex-col space-y-2 sm:flex-row sm:space-y-0 sm:space-x-2">
          <Button
            variant={selectedProvider === "google" ? "default" : "outline"}
            className="w-full sm:w-auto flex-1"
            onClick={() => handleOAuthConnect("google")}
            disabled={isLoading}
          >
            <Mail className="mr-2 h-4 w-4" /> Connect with Gmail
          </Button>
          <Button
            variant={selectedProvider === "microsoft" ? "default" : "outline"}
            className="w-full sm:w-auto flex-1"
            onClick={() => handleOAuthConnect("microsoft")}
            disabled={isLoading}
          >
            <Mail className="mr-2 h-4 w-4" /> Connect with Outlook
          </Button>
        </div>

        {/* Optionally, show a message or separator if a provider is selected */}
        {(selectedProvider === "google" ||
          selectedProvider === "microsoft") && (
          <div className="my-4 text-center text-sm text-muted-foreground">
            Connecting with{" "}
            {selectedProvider === "google" ? "Google" : "Microsoft"}... Follow
            the prompts from the provider.
            <Button
              variant="link"
              onClick={() => setSelectedProvider("manual")}
              className="p-1 h-auto"
            >
              Or, configure manually
            </Button>
          </div>
        )}

        {/* Show manual form only if 'manual' is selected or no provider is chosen yet */}
        {/* For now, let's always show it and user can ignore if using OAuth */}
        {/* A better UX would be to hide/show based on selectedProvider */}
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(submitHandler)}
            className="space-y-6"
          >
            <FormField
              control={form.control}
              name="accountName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Account Name (Optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g., My Work Email" {...field} />
                  </FormControl>
                  <FormDescription>
                    A friendly name for this email account (defaults to email
                    address if left blank).
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="emailAddress"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Email Address</FormLabel>
                  <FormControl>
                    <Input placeholder="your.email@example.com" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Password</FormLabel>
                  <div className="relative">
                    <FormControl>
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                      />
                    </FormControl>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                      onClick={() => setShowPassword(!showPassword)}
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden="true" />
                      )}
                      <span className="sr-only">
                        {showPassword ? "Hide password" : "Show password"}
                      </span>
                    </Button>
                  </div>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="imapServer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IMAP Server</FormLabel>
                    <FormControl>
                      <Input placeholder="imap.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="imapPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IMAP Port</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="993" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <FormField
                control={form.control}
                name="smtpServer"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Server</FormLabel>
                    <FormControl>
                      <Input placeholder="smtp.example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="smtpPort"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>SMTP Port</FormLabel>
                    <FormControl>
                      <Input type="number" placeholder="465" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="security"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Security</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select security type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="SSL/TLS">SSL/TLS</SelectItem>
                      <SelectItem value="STARTTLS">STARTTLS</SelectItem>
                      <SelectItem value="None">None</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    Select the connection security type. SSL/TLS is most common.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex flex-col space-y-4 sm:flex-row sm:space-y-0 sm:space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleTestConnection}
                disabled={isLoading || isTestingConnection}
                className="w-full sm:w-auto"
              >
                {isTestingConnection ? "Testing..." : "Test Connection"}
              </Button>
              <Button
                type="submit"
                disabled={isLoading || isTestingConnection}
                className="w-full sm:w-auto"
              >
                {isLoading
                  ? "Saving..."
                  : initialData?.emailAddress
                  ? "Save Changes"
                  : "Connect Account"}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
