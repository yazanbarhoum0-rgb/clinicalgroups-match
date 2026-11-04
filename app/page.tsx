"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";

type ListingType = "individual" | "group" | "looking_to";
type Gender = "male" | "female" | "both";
type FoundGroupAnswer = "yes" | "no";
type Listing = {
  id: string;
  type: ListingType;
  gender: Gender;
  name: string | null;
  members_count: number | null;
  contact: string;
  notes: string | null;
  looking_for: string | null;
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

function shuffleListings<T>(items: T[]): T[] {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function formatTimeAgo(createdAt: string): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60_000));
  if (elapsedMinutes < 1) return "just now";
  const relative = new Intl.RelativeTimeFormat("en", { numeric: "always" });
  if (elapsedMinutes < 60) return relative.format(-elapsedMinutes, "minute");
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return relative.format(-elapsedHours, "hour");
  const elapsedDays = Math.floor(elapsedHours / 24);
  if (elapsedDays < 30) return relative.format(-elapsedDays, "day");
  const elapsedMonths = Math.floor(elapsedDays / 30);
  return relative.format(-elapsedMonths, "month");
}

export default function Home() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [form, setForm] = useState(initialForm);
  const [typeFilter, setTypeFilter] = useState<ListingType>("group");
  const [genderFilter, setGenderFilter] = useState("all");
  const [groupSizeFilter, setGroupSizeFilter] = useState("all");
  const [listingOrder, setListingOrder] = useState("random");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [copiedListingId, setCopiedListingId] = useState<string | null>(null);
  const [copyFailedListingId, setCopyFailedListingId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Listing | null>(null);
  const deleteDialogRef = useRef<HTMLDialogElement>(null);
  const postSuccessDialogRef = useRef<HTMLDialogElement>(null);
  const postFormDialogRef = useRef<HTMLDialogElement>(null);
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
          .select("id,type,gender,name,members_count,contact,notes,looking_for,created_at")
          .order("created_at", { ascending: false });
        if (!active) return;
        if (error) setLoadError("Listings could not be loaded. Run the latest Supabase migration.");
        else setListings(shuffleListings((data ?? []) as Listing[]));
      } catch {
        if (active) setLoadError("Listings could not be loaded. Check your Supabase connection.");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadListings();
    return () => { active = false; };
  }, []);

  const visibleListings = useMemo(() => {
    const filtered = listings.filter((listing) => {
      const matchesType = listing.type === typeFilter;
      const matchesGender = genderFilter === "all"
        || listing.gender === genderFilter
        || (listing.type === "looking_to" && listing.gender === "both" && genderFilter !== "both");
      const matchesSize = groupSizeFilter === "all" || String(listing.members_count) === groupSizeFilter;
      return matchesType && matchesGender && matchesSize;
    });
    return listingOrder === "latest"
      ? [...filtered].sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at))
      : filtered;
  }, [listings, typeFilter, genderFilter, groupSizeFilter, listingOrder]);
  const availableGenders = form.type === "looking_to"
    ? (["male", "female", "both"] as const)
    : (["male", "female"] as const);

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
        name: form.type !== "group" ? form.name.trim() || null : null,
        members_count: form.type === "group" ? Number(form.membersCount) : null,
        contact: form.contact.trim(),
        notes: form.type === "looking_to" ? null : form.notes.trim() || null,
        looking_for: form.type === "looking_to" ? form.notes.trim() : null,
      }).select("id,type,gender,name,members_count,contact,notes,looking_for,created_at").single();
      if (error) {
        setMessage("Could not post. Check that the Supabase schema is up to date.");
        return;
      }
      setListings((current) => shuffleListings([...current, data as Listing]));
      setForm(initialForm);
      postFormDialogRef.current?.close();
      setMessage("");
      postSuccessDialogRef.current?.showModal();
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
      <header className="site-header">
        <a className="wordmark" href="#top">Vitanova Match</a>
        <span className="brand-rock-loader" aria-hidden="true" />
      </header>

      <section className="registration" id="top">
        <div className="registration-heading">
          <div className="registration-intro">
            <h1>Find your group</h1>
            <p>Hello! You can share what you’re looking for, or scroll down to see if anything meets your needs. Good luck!</p>
          </div>
          <button
            className="create-post-button"
            type="button"
            aria-haspopup="dialog"
            onClick={() => postFormDialogRef.current?.showModal()}
          >
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
            <span>Create a post</span>
          </button>
        </div>
      </section>

      <dialog ref={postFormDialogRef} className="delete-dialog post-dialog" aria-labelledby="post-form-title">
        <h2 id="post-form-title">Create a post</h2>
        <form className="registration-form" id="post-form" onSubmit={submitListing}>
          <fieldset className="field type-field"><legend>What are you posting?</legend>
            <div className="type-switch listing-form-switch">
              {(["individual", "group", "looking_to"] as const).map((type) => <label className={form.type === type ? "selected" : ""} key={type}>
                <input type="radio" name="listing-type" value={type} checked={form.type === type} onChange={() => setForm((current) => ({ ...current, type, gender: type !== "looking_to" && current.gender === "both" ? "" : current.gender }))} />
                {type === "group" ? <svg className="switch-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.2a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8M17 14.2a4.5 4.5 0 0 1 3.5 4.4V20"/></svg> : type === "looking_to" ? <svg className="switch-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg> : <svg className="switch-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>}
                <span>{type === "individual" ? "Individual" : type === "group" ? "Group" : "Looking for"}</span>
              </label>)}
            </div>
          </fieldset>

          <fieldset className="field type-field"><legend>{form.type === "group" ? "Group gender" : form.type === "looking_to" ? "Eligible gender" : "Gender"} <small>Shown publicly</small></legend>
            <div className={`type-switch ${form.type === "looking_to" ? "gender-switch-both" : ""}`}>
              {availableGenders.map((gender) => <label className={form.gender === gender ? "selected" : ""} key={gender}>
                <input type="radio" name="listing-gender" value={gender} required checked={form.gender === gender} onChange={() => setForm({ ...form, gender })} />
                {gender === "male" ? <svg className="switch-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="12" r="5"/><path d="m11.5 8.5 6-6M13 2h4.5v4.5"/></svg> : gender === "female" ? <svg className="switch-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="5"/><path d="M10 12v7M6.5 15.5h7"/></svg> : <svg className="switch-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="7" r="3"/><circle cx="14" cy="7" r="3"/><path d="M1.5 17a5.5 5.5 0 0 1 11 0M9 17a5.5 5.5 0 0 1 9.5-3.7"/></svg>}
                <span>{gender === "male" ? "Male" : gender === "female" ? "Female" : "Both"}</span>
              </label>)}
            </div>
          </fieldset>

          {form.type !== "group" && <label className="field field-wide"><span>Name <small>Optional</small></span>
            <input maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="Your name" />
          </label>}

          {form.type === "group" && <label className="field field-wide"><span>Number of group members <small>2–11</small></span>
            <input type="number" min={2} max={11} step={1} required value={form.membersCount} onChange={(event) => setForm({ ...form, membersCount: event.target.value })} />
          </label>}

          <label className="field field-wide"><span>Contact method <small>Shown publicly</small></span>
            <input required maxLength={150} value={form.contact} onChange={(event) => setForm({ ...form, contact: event.target.value })} placeholder="Telegram @ or WhatsApp" />
          </label>

          <label className="field field-wide"><span>{form.type === "looking_to" ? "Looking for" : "Notes"} <small>{form.type === "looking_to" ? "For group leaders · Eligible people can contact you" : "Optional"}</small></span>
            <textarea maxLength={280} rows={3} required={form.type === "looking_to"} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder={form.type === "looking_to" ? "Describe what you’re looking for" : "Anything else?"} />
          </label>

          <div className="form-submit field-wide">
            <button type="submit" disabled={submitting}>{submitting ? "Posting…" : "Post"}</button>
            <button className="close-post-form" type="button" onClick={() => postFormDialogRef.current?.close()}>Cancel</button>
            {message && <span role="status">{message}</span>}
          </div>
        </form>
      </dialog>

      <section className="directory" aria-label="Student listings">
        <div className="section-heading">
          <h2>Listings</h2>
          <span>{loading ? "Loading…" : visibleListings.length}</span>
        </div>
        <fieldset className="listing-type-field">
          <legend>Show</legend>
          <div className="type-switch listing-type-switch">
            {(["group", "individual", "looking_to"] as const).map((type) => (
              <label className={typeFilter === type ? "selected" : ""} key={type}>
                <input
                  type="radio"
                  name="listing-type-filter"
                  value={type}
                  checked={typeFilter === type}
                  onChange={() => {
                    setTypeFilter(type);
                    if (type !== "group") setGroupSizeFilter("all");
                  }}
                />
                {type === "group" ? (
                  <svg className="goal-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="9" cy="8" r="3" />
                    <path d="M3.5 20v-1.2a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8M17 14.2a4.5 4.5 0 0 1 3.5 4.4V20" />
                  </svg>
                ) : type === "looking_to" ? (
                  <svg className="goal-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="10.5" cy="10.5" r="6.5" />
                    <path d="m15.5 15.5 5 5" />
                  </svg>
                ) : (
                  <svg className="goal-icon" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="9" cy="8" r="3" />
                    <path d="M3.5 20v-1.2a5.5 5.5 0 0 1 11 0V20M19 8v6M16 11h6" />
                  </svg>
                )}
                <span>{type === "group" ? "Find your group" : type === "individual" ? "Create your own group" : "Looking for"}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <div className="filter-panel">
          <h3 className="filters-title">Filters</h3>
          <div className={typeFilter !== "group" ? "filters filters-individual" : "filters"}>
          <label>Order
            <button className={`latest-filter-button ${listingOrder === "latest" ? "active" : ""}`} type="button" aria-pressed={listingOrder === "latest"} onClick={() => setListingOrder((current) => current === "latest" ? "random" : "latest")}>
              <span>Latest</span>
            </button>
          </label>
          {typeFilter === "group" && <label>Group size
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
              <option value="both">Both</option>
            </select>
          </label>
          </div>
        </div>
        {listingMessage && <p className="listing-status" role="status">{listingMessage}</p>}
        {loadError && <p className="setup-message">{loadError}</p>}
        {!loading && !loadError && visibleListings.length === 0 && <p className="empty-state">No listings found.</p>}
        <div className="student-list">
          {loading ? <div className="listing-loader-stage" role="status" aria-label="Loading listings"><div className="banter-loader" aria-hidden="true">{Array.from({ length: 9 }, (_, index) => <div className="banter-loader__box" key={index} />)}</div></div> : visibleListings.map((listing) => <article className="student-row" key={listing.id}>
            <div className="student-card-header">
              <div className="listing-heading">
                {listing.type === "group" ? <svg className="listing-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.2a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8M17 14.2a4.5 4.5 0 0 1 3.5 4.4V20"/></svg> : listing.type === "looking_to" ? <svg className="listing-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg> : <svg className="listing-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>}
                <h3
                  className={`listing-kind listing-kind-${listing.type}`}
                >
                  {listing.type === "group" ? "Group" : listing.type === "looking_to" ? "Looking for" : "Individual"}
                </h3>
              </div>
              <div className="listing-actions">
                <button
                  className="copy-icon-button"
                  type="button"
                  onClick={() => void copyContact(listing)}
                  aria-label={copiedListingId === listing.id ? "Contact copied" : copyFailedListingId === listing.id ? "Copy failed. Try again" : "Copy contact"}
                  title={copiedListingId === listing.id ? "Copied" : copyFailedListingId === listing.id ? "Copy failed" : "Copy contact"}
                >
                  {copiedListingId === listing.id ? "Copied" : copyFailedListingId === listing.id ? "Retry" : "Get in touch"}
                </button>
                <button className="delete-listing-button" type="button" aria-label="Delete listing" title="Delete listing" onClick={() => openDeleteDialog(listing)}>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3.5 5.5h13M8 5.5V3.5h4v2M5.5 5.5l.7 11h7.6l.7-11M8 8.5v5M12 8.5v5" /></svg>
                </button>
              </div>
            </div>
            <div className="student-info">
              {listing.type === "individual" && listing.name && <p className="listing-name"><strong>Name:</strong> {listing.name}</p>}
              <p><strong>{listing.type === "looking_to" ? "Eligible gender:" : "Gender:"}</strong> <span className="listing-gender-value">{listing.gender === "male" ? <svg className="listing-gender-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="12" r="5"/><path d="m11.5 8.5 6-6M13 2h4.5v4.5"/></svg> : listing.gender === "female" ? <svg className="listing-gender-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="5"/><path d="M10 12v7M6.5 15.5h7"/></svg> : <svg className="listing-gender-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="7" cy="7" r="3"/><circle cx="14" cy="7" r="3"/><path d="M1.5 17a5.5 5.5 0 0 1 11 0M9 17a5.5 5.5 0 0 1 9.5-3.7"/></svg>}{listing.gender === "both" ? "Both" : listing.gender[0].toUpperCase() + listing.gender.slice(1)}</span></p>
              {listing.type === "group" && <p><strong>Group size:</strong> {listing.members_count} members</p>}
              <p className="listing-posted"><time dateTime={listing.created_at} title={new Date(listing.created_at).toLocaleString()}>Posted {formatTimeAgo(listing.created_at)}</time></p>
              {listing.type === "looking_to" ? listing.looking_for && <p className="listing-notes"><strong>Looking for:</strong> {listing.looking_for}</p> : listing.notes && <p className="listing-notes"><strong>Notes:</strong> {listing.notes}</p>}
              <p className="listing-contact"><strong>Contact:</strong> {listing.contact}</p>
            </div>
          </article>)}
        </div>
      </section>

      <dialog ref={postSuccessDialogRef} className="delete-dialog success-dialog" aria-labelledby="post-success-title">
        <h2 id="post-success-title">Your listing has been posted</h2>
        <p>You can scroll and check for matches, or wait for someone to reach out.</p>
        <div className="dialog-actions">
          <button type="button" className="confirm-delete" onClick={() => postSuccessDialogRef.current?.close()}>Continue browsing</button>
        </div>
      </dialog>

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
