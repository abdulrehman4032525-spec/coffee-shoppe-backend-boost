import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  checkIsAdmin,
  listReservations,
  listMessages,
  listSubscribers,
  updateReservationStatus,
  deleteReservation,
  deleteMessage,
  deleteSubscriber,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
  head: () => ({ meta: [{ title: "Admin | Coffee Shoppe" }] }),
});

function AdminPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [authReady, setAuthReady] = useState(false);

  const checkAdminFn = useServerFn(checkIsAdmin);
  const listResFn = useServerFn(listReservations);
  const listMsgFn = useServerFn(listMessages);
  const listSubFn = useServerFn(listSubscribers);
  const updateStatusFn = useServerFn(updateReservationStatus);
  const delResFn = useServerFn(deleteReservation);
  const delMsgFn = useServerFn(deleteMessage);
  const delSubFn = useServerFn(deleteSubscriber);

  useEffect(() => {
    setAuthReady(true);
  }, []);

  const adminCheck = useQuery({
    queryKey: ["is-admin"],
    queryFn: () => checkAdminFn(),
    enabled: authReady,
    retry: false,
  });

  useEffect(() => {
    if (adminCheck.isError) {
      toast.error("Access denied");
      navigate({ to: "/login" });
    } else if (adminCheck.data && !adminCheck.data.isAdmin) {
      toast.error("This account is not an admin");
      supabase.auth.signOut();
      navigate({ to: "/login" });
    }
  }, [adminCheck.data, adminCheck.isError, navigate]);

  const reservations = useQuery({
    queryKey: ["reservations"],
    queryFn: () => listResFn(),
    enabled: !!adminCheck.data?.isAdmin,
  });
  const messages = useQuery({
    queryKey: ["messages"],
    queryFn: () => listMsgFn(),
    enabled: !!adminCheck.data?.isAdmin,
  });
  const subscribers = useQuery({
    queryKey: ["subscribers"],
    queryFn: () => listSubFn(),
    enabled: !!adminCheck.data?.isAdmin,
  });

  const updateStatus = useMutation({
    mutationFn: (vars: { id: string; status: "pending" | "confirmed" | "cancelled" }) =>
      updateStatusFn({ data: vars }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      toast.success("Status updated — customer notified by email");
    },
    onError: (e: any) => toast.error(e?.message ?? "Update failed"),
  });

  const removeRes = useMutation({
    mutationFn: (id: string) => delResFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["reservations"] });
      toast.success("Reservation deleted");
    },
  });
  const removeMsg = useMutation({
    mutationFn: (id: string) => delMsgFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["messages"] });
      toast.success("Message deleted");
    },
  });
  const removeSub = useMutation({
    mutationFn: (id: string) => delSubFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subscribers"] });
      toast.success("Subscriber removed");
    },
  });

  const onLogout = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const exportSubscribersCsv = () => {
    const rows = subscribers.data?.subscribers ?? [];
    const csv = ["email,subscribed_at", ...rows.map((r) => `${r.email},${r.subscribed_at}`)].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "newsletter-subscribers.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (adminCheck.isLoading || !adminCheck.data?.isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center text-muted-foreground">
        Verifying admin access…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-card/50">
        <div className="max-w-7xl mx-auto px-6 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-wide text-foreground">Coffee Shoppe</h1>
            <p className="text-xs text-muted-foreground uppercase tracking-widest">Admin Dashboard</p>
          </div>
          <Button variant="outline" onClick={onLogout}>Sign Out</Button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8">
        <Tabs defaultValue="reservations">
          <TabsList>
            <TabsTrigger value="reservations">
              Reservations ({reservations.data?.reservations.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="messages">
              Messages ({messages.data?.messages.length ?? 0})
            </TabsTrigger>
            <TabsTrigger value="subscribers">
              Subscribers ({subscribers.data?.subscribers.length ?? 0})
            </TabsTrigger>
          </TabsList>

          {/* RESERVATIONS */}
          <TabsContent value="reservations" className="mt-6">
            <Card className="bg-card border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead>Date / Time</TableHead>
                    <TableHead>Party</TableHead>
                    <TableHead>Notes</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {reservations.isLoading && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  )}
                  {reservations.data?.reservations.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">No reservations yet</TableCell></TableRow>
                  )}
                  {reservations.data?.reservations.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-sm">
                        <div>{r.email}</div>
                        <div className="text-muted-foreground">{r.phone}</div>
                      </TableCell>
                      <TableCell>{r.reservation_date} <span className="text-muted-foreground">{String(r.reservation_time).slice(0,5)}</span></TableCell>
                      <TableCell>{r.party_size}</TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground" title={r.special_requests ?? ""}>
                        {r.special_requests || "—"}
                      </TableCell>
                      <TableCell>
                        <Select
                          value={r.status}
                          onValueChange={(v) =>
                            updateStatus.mutate({ id: r.id, status: v as any })
                          }
                        >
                          <SelectTrigger className="w-[140px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="confirmed">Confirmed</SelectItem>
                            <SelectItem value="cancelled">Cancelled</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeRes.mutate(r.id)}>
                          Delete
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>

          {/* MESSAGES */}
          <TabsContent value="messages" className="mt-6">
            <div className="grid gap-4">
              {messages.isLoading && <p className="text-muted-foreground">Loading…</p>}
              {messages.data?.messages.length === 0 && (
                <p className="text-muted-foreground">No messages yet</p>
              )}
              {messages.data?.messages.map((m) => (
                <Card key={m.id} className="p-5 bg-card border-border">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline gap-3">
                        <h3 className="font-medium text-foreground">{m.name}</h3>
                        <span className="text-sm text-muted-foreground">{m.email}</span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {new Date(m.created_at).toLocaleString()}
                      </p>
                      <p className="mt-3 whitespace-pre-wrap text-foreground/90">{m.message}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => removeMsg.mutate(m.id)}>
                      Delete
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* SUBSCRIBERS */}
          <TabsContent value="subscribers" className="mt-6">
            <div className="flex justify-end mb-3">
              <Button onClick={exportSubscribersCsv} variant="outline">
                Export CSV
              </Button>
            </div>
            <Card className="bg-card border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Email</TableHead>
                    <TableHead>Subscribed</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subscribers.isLoading && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">Loading…</TableCell></TableRow>
                  )}
                  {subscribers.data?.subscribers.length === 0 && (
                    <TableRow><TableCell colSpan={3} className="text-center text-muted-foreground py-8">No subscribers yet</TableCell></TableRow>
                  )}
                  {subscribers.data?.subscribers.map((s) => (
                    <TableRow key={s.id}>
                      <TableCell className="font-medium">{s.email}</TableCell>
                      <TableCell className="text-muted-foreground">
                        {new Date(s.subscribed_at).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => removeSub.mutate(s.id)}>
                          Remove
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

// Redirect /admin → /_authenticated/admin? In TanStack Start with this layout
// pattern, the URL is /admin (the _authenticated prefix is pathless). So /admin works directly.
