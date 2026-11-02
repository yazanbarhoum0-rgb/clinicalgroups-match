"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ListingType = "individual" | "group";
type Gender = "male" | "female";
type FoundGroupAnswer = "yes" | "no";
type Listing = {
  id: string;
  type: ListingType;
  gender: Gender;
  name: string | null;
  members_count: number | null;
  contact: string;
  notes: string | null;
  created_at: string;
};

const initialForm = {
  type: "individual" as ListingType,
  gender: "" as Gender | "",
  name: "",
  membersCount: "2",
  contact: "",
  notes: "",
};

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [form, setForm] = useState(initialForm);
  const [typeFilter, setTypeFilter] = useState("all");
  const [genderFilter, setGenderFilter] = useState("all");
  const [groupSizeFilter, setGroupSizeFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedListingId, setCopiedListingId] = useState<string | null>(null);
  const [copyFailedListingId, setCopyFailedListingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const [foundGroupAnswer, setFoundGroupAnswer] = useState<FoundGroupAnswer | null>(null);
  const [deleteContact, setDeleteContact] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");
  const [listingMessage, setListingMessage] = useState("");

  useEffect(() => {
    const dialog = deleteDialogRef.current;
    if (deleteTarget && dialog && !dialog.open) dialog.showModal();
    return () => {
      if (dialog?.open) dialog.close();
    };
  }, [deleteTarget]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let active = true;
    async function loadListings() {
      if (!supabase) {
        setLoading(false);
        setLoadError("Connect your Supabase project to load and save listings.");
        return;
      }
      try {
        const { data, error } = await supabase
          .from("clinical_listings")
          .select("id,type,gender,name,members_count,contact,notes,created_at")
          .order("created_at", { ascending: false });
        if (!active) return;
        if (error) setLoadError("Listings could not be loaded. Run the latest Supabase migration.");
        else setListings((data ?? []) as Listing[]);
      } catch {
        if (active) setLoadError("Listings could not be loaded. Check your Supabase connection.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadListings();
    return () => { active = false; };
  }, []);

  const visibleListings = useMemo(() => listings.filter((listing) => {
    const matchesType = typeFilter === "all" || listing.type === typeFilter;
    const matchesGender = genderFilter === "all" || listing.gender === genderFilter;
    const matchesSize = groupSizeFilter === "all" || String(listing.members_count) === groupSizeFilter;
    return matchesType && matchesGender && matchesSize;
  }), [listings, typeFilter, genderFilter, groupSizeFilter]);

  async function submitListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    if (!supabase) {
      setMessage("Supabase is not connected yet.");
      return;
    }
    setSubmitting(true);
    try {
      const { data, error } = await supabase.from("clinical_listings").insert({
        type: form.type,
        gender: form.gender,
        name: form.type === "individual" ? form.name.trim() || null : null,
        members_count: form.type === "group" ? Number(form.membersCount) : null,
        contact: form.contact.trim(),
        notes: form.notes.trim() || null,
      }).select("id,type,gender,name,members_count,contact,notes,created_at").single();
      if (error) {
        setMessage("Could not post. Check that the Supabase schema is up to date.");
        return;
      }
      setListings((current) => [data as Listing, ...current]);
      setForm(initialForm);
      setMessage("Posted.");
    } catch {
      setMessage("Could not post. Check your Supabase connection.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyContact(listing: Listing) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(listing.contact);
      } else {
        const field = document.createElement("textarea");
        field.value = listing.contact;
        field.setAttribute("readonly", "");
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        const copied = document.execCommand("copy");
        field.remove();
        if (!copied) throw new Error("Copy failed");
      }
      setCopiedListingId(listing.id);
      setCopyFailedListingId(null);
    } catch {
      setCopiedListingId(null);
      setCopyFailedListingId(listing.id);
    }
  }

  function openDeleteDialog(listing: Listing) {
    setDeleteTarget(listing);
    setFoundGroupAnswer(null);
    setDeleteContact("");
    setDeleteError("");
  }

  async function deleteListing() {
    if (!deleteTarget || !foundGroupAnswer) return;
    if (deleteContact.trim() !== deleteTarget.contact.trim()) {
      setDeleteError("The contact method does not match.");
      return;
    }
    if (!supabase) {
      setDeleteError("Supabase is not connected.");
      return;
    }

    setDeleting(true);
    setDeleteError("");
    try {
      const { data, error } = await supabase
        .from("clinical_listings")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("contact", deleteContact.trim())
        .select("id");
      if (error || !data?.length) {
        setDeleteError("Could not delete this listing. Check the Supabase delete policy.");
        return;
      }
      setListings((current) => current.filter((listing) => listing.id !== deleteTarget.id));
      setListingMessage(foundGroupAnswer === "yes" ? "Listing deleted. Glad you found your group." : "Listing deleted.");
      setDeleteTarget(null);
    } catch {
      setDeleteError("Could not delete this listing. Check your Supabase connection.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <main className="directory-page">
      <header className="site-header"><a className="wordmark" href="#top">Clinical Match</a></header>

      <section className="registration" id="top">
        <h1>Find your group</h1>
        <form className="registration-form" onSubmit={submitListing}>
          <label className="field"><span>Are you an individual or a group?</span>
            <select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as ListingType })}>
              <option value="individual">Individual</option>
              <option value="group">Group</option>
            </select>
          </label>

          <label className="field"><span>{form.type === "group" ? "Group gender" : "Gender"} <small>Shown publicly</small></span>
            <select required value={form.gender} onChange={(event) => setForm({ ...form, gender: event.target.value as Gender })}>
              <option value="" disabled>Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>

          {form.type === "individual" && <label className="field field-wide"><span>Name <small>Optional</small></span>
            <input maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" />
          </label>}

          {form.type === "group" && <label className="field field-wide"><span>Number of group members <small>2–11</small></span>
            <input type="number" min={2} max={11} step={1} required value={form.membersCount} onChange={(event) => setForm({ ...form, membersCount: event.target.value })} />
          </label>}

          <label className="field field-wide"><span>Contact method <small>Shown publicly</small></span>
            <input required maxLength={150} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="Telegram @ or WhatsApp" />
          </label>

          <label className="field field-wide"><span>Notes/Prefrences <small>Optional</small></span>
            <textarea maxLength={280} rows={2} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Anything else?" />
          </label>

          <div className="form-submit field-wide">
            <button type="submit" disabled={submitting}>{submitting ? "Posting…" : "Post"}</button>
            {message && <span role="status">{message}</span>}
          </div>
        </form>
      </section>

      <section className="directory" aria-label="Student listings">
        <div className="section-heading">
          <h2>Listings</h2>
          <span>{loading ? "Loading…" : visibleListings.length}</span>
        </div>
        <div className={typeFilter === "individual" ? "filters filters-individual" : "filters"}>
          <label>Type
            <select value={typeFilter} onChange={(event) => {
              const nextType = event.target.value;
              setTypeFilter(nextType);
              if (nextType === "individual") setGroupSizeFilter("all");
            }}>
              <option value="all">All</option><option value="individual">Individuals</option><option value="group">Groups</option>
            </select>
          </label>
          {typeFilter !== "individual" && <label>Group size
            <select value={groupSizeFilter} onChange={(event) => setGroupSizeFilter(event.target.value)}>
              <option value="all">Any</option>
              {Array.from({ length: 10 }, (_, index) => index + 2).map((size) => <option value={size} key={size}>{size}</option>)}
            </select>
          </label>}
          <label>Gender
            <select value={genderFilter} onChange={(event) => setGenderFilter(event.target.value)}>
              <option value="all">All</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
            </select>
          </label>
        </div>
        {listingMessage && <p className="listing-status" role="status">{listingMessage}</p>}
        {loadError && <p className="setup-message">{loadError}</p>}
        {!loading && !loadError && visibleListings.length === 0 && <p className="empty-state">No listings found.</p>}
        <div className="student-list">
          {visibleListings.map((listing) => <article className="student-row" key={listing.id}>
            <div className="student-info">
              <div className="listing-heading">
                {listing.type === "group" ? <svg className="listing-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.2a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8M17 14.2a4.5 4.5 0 0 1 3.5 4.4V20"/></svg> : <svg className="listing-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>}
                <h3>{listing.type === "group" ? `Group · ${listing.members_count} members` : `Individual${listing.name ? ` · ${listing.name}` : ""}`} <span>· {listing.gender[0].toUpperCase() + listing.gender.slice(1)}</span></h3>
              </div>
              <p className="listing-contact"><strong>Contact:</strong> {listing.contact}</p>
              {listing.notes && <p className="listing-notes"><strong>Notes:</strong> {listing.notes}</p>}
            </div>
            <div className="listing-actions">
              <button
                className="copy-icon-button"
                type="button"
                onClick={() => void copyContact(listing)}
                aria-label={copiedListingId === listing.id ? "Contact copied" : copyFailedListingId === listing.id ? "Copy failed. Try again" : "Copy contact"}
                title={copiedListingId === listing.id ? "Copied" : copyFailedListingId === listing.id ? "Copy failed" : "Copy contact"}
              >
                {copiedListingId === listing.id ? <svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8" /></svg> : <svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="9" height="11" rx="1.5"/><path d="M5 14V4.5A1.5 1.5 0 0 1 6.5 3H13" /></svg>}
              </button>
              <button className="delete-listing-button" type="button" onClick={() => openDeleteDialog(listing)}>Delete</button>
            </div>
          </article>)}
        </div>
      </section>

      {deleteTarget && <dialog
        ref={deleteDialogRef}
        className="delete-dialog"
        aria-labelledby="delete-dialog-title"
        onCancel={(event) => { event.preventDefault(); setDeleteTarget(null); }}
      >
          <h2 id="delete-dialog-title">Delete listing</h2>
          <p className="dialog-question">Did you find your match?</p>
          <div className="dialog-choices">
            <button className={foundGroupAnswer === "yes" ? "chosen" : ""} type="button" onClick={() => { setFoundGroupAnswer("yes"); setDeleteError(""); }}>Yes</button>
            <button className={foundGroupAnswer === "no" ? "chosen" : ""} type="button" onClick={() => { setFoundGroupAnswer("no"); setDeleteError(""); }}>No</button>
          </div>
          {foundGroupAnswer && <label className="delete-contact-field">
            <span>Re-enter this listing’s contact method to confirm</span>
            <input autoComplete="off" value={deleteContact} onChange={(event) => { setDeleteContact(event.target.value); setDeleteError(""); }} placeholder="Contact method" />
          </label>}
          {deleteError && <p className="delete-error" role="alert">{deleteError}</p>}
          <div className="dialog-actions">
            <button type="button" className="cancel-delete" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</button>
            <button type="button" className="confirm-delete" onClick={() => void deleteListing()} disabled={!foundGroupAnswer || deleteContact.trim() !== deleteTarget.contact.trim() || deleting}>{deleting ? "Deleting…" : "Delete listing"}</button>
          </div>
      </dialog>}
    </main>
  );
}
