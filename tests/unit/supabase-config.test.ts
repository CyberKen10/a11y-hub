import { describe, expect, it } from "vitest";
import {
  isHtmlParseError,
  supabaseAnonError,
  supabaseUrlError,
} from "@/lib/supabase/config";

describe("supabaseUrlError", () => {
  it("accepts a project URL", () => {
    expect(supabaseUrlError("https://abcd.supabase.co")).toBeNull();
    expect(supabaseUrlError("https://abcd.supabase.co/")).toBeNull();
  });

  it("rejects keys and dashboard hosts", () => {
    expect(supabaseUrlError("sb_publishable_abc")).toMatch(/no es una clave/i);
    expect(supabaseUrlError("https://supabase.com/dashboard/project/x")).toMatch(
      /Project URL/i
    );
  });
});

describe("supabaseAnonError", () => {
  it("rejects a URL in the key field", () => {
    expect(supabaseAnonError("https://abcd.supabase.co")).toMatch(/es una URL/i);
  });
});

describe("isHtmlParseError", () => {
  it("detects the HTML-as-JSON symptom", () => {
    expect(
      isHtmlParseError(`Unexpected token '<', "<!DOCTYPE "... is not valid JSON`)
    ).toBe(true);
  });
});
