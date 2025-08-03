"use client";

import { redirect } from "next/navigation";

export default function AdminPage() {
  // Redirect to the whitelists tab by default
  redirect("/admin/whitelists");
} 
