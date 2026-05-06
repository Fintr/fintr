"use client";

import { redirect } from "next/navigation";

export default function AdminPage() {
  // Redirect to the users tab by default
redirect("/admin/users");
} 
