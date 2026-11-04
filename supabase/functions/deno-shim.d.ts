// Yalnız tip yoxlaması üçün: funksiyaların istifadə etdiyi Deno API-ləri. İş vaxtında real Deno istifadə olunur.
declare namespace Deno {
  function serve(handler: (req: Request) => Response | Promise<Response>): unknown
  const env: { get(key: string): string | undefined }
}
