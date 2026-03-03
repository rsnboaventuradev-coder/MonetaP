// Type declarations for Deno edge functions to satisfy standard TypeScript servers
// when the Deno extension is not active or improperly configured.

declare const Deno: any;

declare module "https://deno.land/std@0.168.0/http/server.ts" {
    export function serve(handler: (req: Request) => Response | Promise<Response>): void;
}

declare module "https://esm.sh/@supabase/supabase-js@2" {
    export function createClient(
        url: string,
        key: string,
        options?: any
    ): any;
}
