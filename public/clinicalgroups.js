// Publishable keys are intended to be public. Never place a Supabase secret key here.
const SUPABASE_URL = "https://lpgebueramruddfphgsv.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_7exv4hxkidhmWcwh-XiQYQ_vczrNR1G";
const TABLE_URL = `${SUPABASE_URL}/rest/v1/clinical_listings`;
const FIELDS = "id,type,gender,name,members_count,contact,notes,created_at";

const listings = [];
let deleteTarget = null;
let foundGroupAnswer = null;

const form = document.querySelector("#listing-form");
const typeInputs = [...document.querySelectorAll('input[name="listing-type"]')];
const selectedType = () => typeInputs.find((input) => input.checked)?.value || "individual";
const genderInputs = [...document.querySelectorAll('input[name="listing-gender"]')];
const selectedGender = () => genderInputs.find((input) => input.checked)?.value || "";
const genderLabel = document.querySelector("#gender-label");
const individualNameField = document.querySelector("#individual-name-field");
const groupSizeField = document.querySelector("#group-size-field");
const membersCountInput = document.querySelector("#members-count");
const typeFilter = document.querySelector("#type-filter");
const groupSizeFilterField = document.querySelector("#group-size-filter-field");
const groupSizeFilter = document.querySelector("#group-size-filter");
const genderFilter = document.querySelector("#gender-filter");
const listingOrder = document.querySelector("#listing-order");
const listElement = document.querySelector("#student-list");
const listingCount = document.querySelector("#listing-count");
const emptyState = document.querySelector("#empty-state");
const loadError = document.querySelector("#load-error");
const listingMessage = document.querySelector("#listing-message");
const formMessage = document.querySelector("#form-message");
const postButton = document.querySelector("#post-button");
const postSuccessDialog = document.querySelector("#post-success-dialog");
const deleteDialog = document.querySelector("#delete-dialog");
const deleteContactField = document.querySelector("#delete-contact-field");
const deleteContactInput = document.querySelector("#delete-contact");
const deleteError = document.querySelector("#delete-error");
const confirmDeleteButton = document.querySelector("#confirm-delete");

function apiHeaders(extra = {}) {
  return { apikey: SUPABASE_PUBLISHABLE_KEY, ...extra };
}

function showFormMessage(message) {
  formMessage.textContent = message;
}

function shuffleListings(items) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

function formatTimeAgo(createdAt) {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - Date.parse(createdAt)) / 60000));
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

function updateFormType() {
  const isGroup = selectedType() === "group";
  individualNameField.hidden = isGroup;
  groupSizeField.hidden = !isGroup;
  membersCountInput.required = isGroup;
  genderLabel.textContent = isGroup ? "Group gender" : "Gender";
}

function updateFilters() {
  const individualsOnly = typeFilter.value === "individual";
  groupSizeFilterField.hidden = individualsOnly;
  document.querySelector("#listing-filters").classList.toggle("filters-individual", individualsOnly);
  if (individualsOnly) groupSizeFilter.value = "all";
  renderListings();
}

function matchesFilters(listing) {
  if (typeFilter.value !== "all" && listing.type !== typeFilter.value) return false;
  if (genderFilter.value !== "all" && listing.gender !== genderFilter.value) return false;
  if (groupSizeFilter.value !== "all" && String(listing.members_count) !== groupSizeFilter.value) return false;
  return true;
}

function svgElement(markup) {
  const wrapper = document.createElement("span");
  wrapper.innerHTML = markup;
  return wrapper.firstElementChild;
}

function personIcon() {
  return svgElement('<svg class="listing-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="3.5"/><path d="M5.5 20a6.5 6.5 0 0 1 13 0"/></svg>');
}

function groupIcon() {
  return svgElement('<svg class="listing-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3"/><path d="M3.5 20v-1.2a5.5 5.5 0 0 1 11 0V20M16 5.5a3 3 0 0 1 0 5.8M17 14.2a4.5 4.5 0 0 1 3.5 4.4V20"/></svg>');
}

function genderIcon(gender) {
  return svgElement(gender === "male"
    ? '<svg class="listing-gender-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="8" cy="12" r="5"/><path d="m11.5 8.5 6-6M13 2h4.5v4.5"/></svg>'
    : '<svg class="listing-gender-icon" viewBox="0 0 20 20" aria-hidden="true"><circle cx="10" cy="7" r="5"/><path d="M10 12v7M6.5 15.5h7"/></svg>');
}

function makeCopyIcon(copied = false) {
  return copied
    ? '<svg viewBox="0 0 20 20" aria-hidden="true"><path d="m4 10 4 4 8-8"/></svg>'
    : '<svg viewBox="0 0 20 20" aria-hidden="true"><rect x="7" y="6" width="9" height="11" rx="1.5"/><path d="M5 14V4.5A1.5 1.5 0 0 1 6.5 3H13"/></svg>';
}

function renderListings() {
  const visible = listings.filter(matchesFilters);
  if (listingOrder.getAttribute("aria-pressed") === "true") visible.sort((first, second) => Date.parse(second.created_at) - Date.parse(first.created_at));
  listElement.replaceChildren();
  listingCount.textContent = String(visible.length);
  emptyState.hidden = visible.length > 0;

  for (const listing of visible) {
    const row = document.createElement("article");
    row.className = "student-row";

    const info = document.createElement("div");
    info.className = "student-info";

    const heading = document.createElement("div");
    heading.className = "listing-heading";
    heading.append(listing.type === "group" ? groupIcon() : personIcon());

    const title = document.createElement("h3");
    title.className = `listing-kind listing-kind-${listing.type}`;
    title.textContent = listing.type === "group" ? "Group" : `Individual${listing.name ? ` · ${listing.name}` : ""}`;
    heading.append(title);
    info.append(heading);

    const gender = document.createElement("p");
    const genderLabel = document.createElement("strong");
    genderLabel.textContent = "Gender: ";
    const genderValue = document.createElement("span");
    genderValue.className = "listing-gender-value";
    genderValue.append(genderIcon(listing.gender), document.createTextNode(`${listing.gender[0].toUpperCase()}${listing.gender.slice(1)}`));
    gender.append(genderLabel, genderValue);
    info.append(gender);

    if (listing.type === "group") {
      const size = document.createElement("p");
      const sizeLabel = document.createElement("strong");
      sizeLabel.textContent = "Group size: ";
      size.append(sizeLabel, document.createTextNode(`${listing.members_count} members`));
      info.append(size);
    }

    const posted = document.createElement("p");
    posted.className = "listing-posted";
    const postedTime = document.createElement("time");
    postedTime.dateTime = listing.created_at;
    postedTime.title = new Date(listing.created_at).toLocaleString();
    postedTime.textContent = `Posted ${formatTimeAgo(listing.created_at)}`;
    posted.append(postedTime);
    info.append(posted);

    const contact = document.createElement("p");
    contact.className = "listing-contact";
    const contactLabel = document.createElement("strong");
    contactLabel.textContent = "Contact: ";
    contact.append(contactLabel, document.createTextNode(listing.contact));
    info.append(contact);

    if (listing.notes) {
      const note = document.createElement("p");
      note.className = "listing-notes";
      const noteLabel = document.createElement("strong");
      noteLabel.textContent = "Notes: ";
      note.append(noteLabel, document.createTextNode(listing.notes));
      info.append(note);
    }

    const actions = document.createElement("div");
    actions.className = "listing-actions";

    const copyButton = document.createElement("button");
    copyButton.className = "copy-icon-button";
    copyButton.type = "button";
    copyButton.setAttribute("aria-label", "Copy contact");
    copyButton.title = "Copy contact";
    copyButton.innerHTML = makeCopyIcon();
    copyButton.addEventListener("click", () => copyContact(listing, copyButton));

    const deleteButton = document.createElement("button");
    deleteButton.className = "delete-listing-button";
    deleteButton.type = "button";
    deleteButton.textContent = "Delete";
    deleteButton.addEventListener("click", () => openDeleteDialog(listing));

    actions.append(copyButton, deleteButton);
    row.append(info, actions);
    listElement.append(row);
  }
}

async function loadListings() {
  listingCount.textContent = "Loading…";
  loadError.hidden = true;
  try {
    const response = await fetch(`${TABLE_URL}?select=${FIELDS}&order=created_at.desc`, {
      headers: apiHeaders(),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Run the latest Supabase migrations.");
    listings.splice(0, listings.length, ...shuffleListings(data));
    renderListings();
  } catch (error) {
    listingCount.textContent = "—";
    loadError.textContent = `Listings could not be loaded. ${error.message || "Check the Supabase connection."}`;
    loadError.hidden = false;
    emptyState.hidden = true;
  }
}

async function copyContact(listing, button) {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(listing.contact);
    } else {
      const input = document.createElement("textarea");
      input.value = listing.contact;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.opacity = "0";
      document.body.append(input);
      input.select();
      const copied = document.execCommand("copy");
      input.remove();
      if (!copied) throw new Error("Copy failed");
    }
    button.innerHTML = makeCopyIcon(true);
    button.title = "Copied";
    button.setAttribute("aria-label", "Contact copied");
  } catch {
    button.title = "Copy failed";
    button.setAttribute("aria-label", "Copy failed. Try again");
  }
}

function openDeleteDialog(listing) {
  deleteTarget = listing;
  foundGroupAnswer = null;
  deleteContactInput.value = "";
  deleteContactField.hidden = true;
  deleteError.hidden = true;
  deleteError.textContent = "";
  confirmDeleteButton.disabled = true;
  deleteDialog.querySelectorAll("[data-found-answer]").forEach((button) => button.classList.remove("chosen"));
  deleteDialog.showModal();
}

async function deleteListing() {
  if (!deleteTarget || !foundGroupAnswer) return;
  if (deleteContactInput.value.trim() !== deleteTarget.contact.trim()) {
    deleteError.textContent = "The contact method does not match.";
    deleteError.hidden = false;
    return;
  }

  confirmDeleteButton.disabled = true;
  confirmDeleteButton.textContent = "Deleting…";
  deleteError.hidden = true;
  const target = deleteTarget;
  try {
    const params = new URLSearchParams({
      id: `eq.${target.id}`,
      contact: `eq.${deleteContactInput.value.trim()}`,
      select: "id",
    });
    const response = await fetch(`${TABLE_URL}?${params}`, {
      method: "DELETE",
      headers: apiHeaders({ Prefer: "return=representation" }),
    });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data) || data.length === 0) {
      throw new Error(data.message || "Check the Supabase delete policy.");
    }

    const answer = foundGroupAnswer;
    const index = listings.findIndex((listing) => listing.id === target.id);
    if (index >= 0) listings.splice(index, 1);
    deleteDialog.close();
    deleteTarget = null;
    listingMessage.textContent = answer === "yes" ? "Listing deleted. Glad you found your group." : "Listing deleted.";
    listingMessage.hidden = false;
    renderListings();
  } catch (error) {
    deleteError.textContent = error.message || "Could not delete this listing.";
    deleteError.hidden = false;
    confirmDeleteButton.disabled = false;
  } finally {
    confirmDeleteButton.textContent = "Delete listing";
  }
}

typeInputs.forEach((input) => input.addEventListener("change", () => {
  typeInputs.forEach((radio) => radio.closest("label").classList.toggle("selected", radio.checked));
  updateFormType();
}));
genderInputs.forEach((input) => input.addEventListener("change", () => {
  genderInputs.forEach((radio) => radio.closest("label").classList.toggle("selected", radio.checked));
}));
typeFilter.addEventListener("change", updateFilters);
genderFilter.addEventListener("change", renderListings);
listingOrder.addEventListener("click", () => {
  const active = listingOrder.getAttribute("aria-pressed") !== "true";
  listingOrder.setAttribute("aria-pressed", String(active));
  listingOrder.classList.toggle("active", active);
  renderListings();
});
groupSizeFilter.addEventListener("change", renderListings);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  showFormMessage("");
  const isGroup = selectedType() === "group";
  const contact = document.querySelector("#listing-contact").value.trim();
  const payload = {
    type: selectedType(),
    gender: selectedGender(),
    name: isGroup ? null : document.querySelector("#listing-name").value.trim() || null,
    members_count: isGroup ? Number(membersCountInput.value) : null,
    contact,
    notes: document.querySelector("#listing-notes").value.trim() || null,
  };

  if (!contact || !payload.gender || (isGroup && (!Number.isInteger(payload.members_count) || payload.members_count < 2 || payload.members_count > 11))) {
    showFormMessage("Complete the required fields.");
    return;
  }

  postButton.disabled = true;
  postButton.textContent = "Posting…";
  try {
    const response = await fetch(`${TABLE_URL}?select=${FIELDS}`, {
      method: "POST",
      headers: apiHeaders({ "Content-Type": "application/json", Prefer: "return=representation" }),
      body: JSON.stringify(payload),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.message || "Check that the Supabase schema is up to date.");
    listings.splice(0, listings.length, ...shuffleListings([...listings, data[0]]));
    form.reset();
    typeInputs[0].checked = true;
    typeInputs.forEach((radio) => radio.closest("label").classList.toggle("selected", radio.checked));
    genderInputs.forEach((radio) => radio.closest("label").classList.toggle("selected", radio.checked));
    membersCountInput.value = "2";
    updateFormType();
    renderListings();
    showFormMessage("");
    postSuccessDialog.showModal();
  } catch (error) {
    showFormMessage(`Could not post. ${error.message || "Check the Supabase connection."}`);
  } finally {
    postButton.disabled = false;
    postButton.textContent = "Post";
  }
});

deleteDialog.querySelectorAll("[data-found-answer]").forEach((button) => {
  button.addEventListener("click", () => {
    foundGroupAnswer = button.dataset.foundAnswer;
    deleteDialog.querySelectorAll("[data-found-answer]").forEach((choice) => choice.classList.toggle("chosen", choice === button));
    deleteContactField.hidden = false;
    deleteContactInput.focus();
    deleteError.hidden = true;
    updateDeleteButton();
  });
});

function updateDeleteButton() {
  confirmDeleteButton.disabled = !foundGroupAnswer || !deleteTarget || deleteContactInput.value.trim() !== deleteTarget.contact.trim();
}

deleteContactInput.addEventListener("input", updateDeleteButton);
confirmDeleteButton.addEventListener("click", deleteListing);
document.querySelector("#close-post-success").addEventListener("click", () => postSuccessDialog.close());
document.querySelector("#cancel-delete").addEventListener("click", () => deleteDialog.close());
deleteDialog.addEventListener("close", () => { deleteTarget = null; });
deleteDialog.addEventListener("cancel", () => { deleteTarget = null; });

updateFormType();
updateFilters();
loadListings();
