# Data Safety & Privacy — Store Questionnaires

**Purpose:** Technical reference for Google Play Console (Data Safety) and App Store (Privacy) forms. Voyager Sanctuary uses Supabase with Row Level Security (RLS); data is not shared with third parties. Use this doc when filling out the questionnaires and when hosting your Privacy Policy URL.

**Related:** [LEGAL.md](LEGAL.md) (Terms of Service and hosting instructions), [RLS_VERIFICATION.md](RLS_VERIFICATION.md), [STORE_LISTING.md](STORE_LISTING.md), [HEALTH_AND_IMPROVEMENTS.md](HEALTH_AND_IMPROVEMENTS.md) Item 24.

---

## 1. Google Play — Data Safety

### Summary answers

| Question | Your Answer | Technical Context |
|----------|-------------|-------------------|
| **Data collected?** | Yes | Email (for Auth) and user-generated content (Mountain/Pebble names, intent statements). |
| **Data shared?** | No | Data is never shared with third parties. Supabase is infrastructure only; no analytics or ad SDKs. |
| **Data encrypted?** | Yes | All data encrypted in transit (HTTPS/TLS). At rest per Supabase (encrypted storage). |
| **Delete account?** | Yes | Users can delete their account and all associated data from the app Settings screen. |

### Specific data types to declare

| Category | Type | Purpose |
|----------|------|--------|
| **Personal info** | Email address | Account setup and authentication (Supabase Auth). |
| **App activity** | Product interaction / usage | e.g. when a user "burns" a pebble; used to calculate streaks and momentum (Whetstone, Hearth). |
| **User content** | Other user-generated content | Project titles (Mountains), task names (Pebbles), intent statements. Stored in Supabase; RLS ensures only the owning user can access. |

---

## 2. Privacy Policy — Draft Text (Sanctuary Standard)

Use this text for the **Privacy Policy URL** required by both stores. Host it at a stable URL (e.g. your site or a static page) and paste that URL into the store consoles.

---

**Voyager Sanctuary Privacy Policy**

**Your Path is Private.**

At Voyager Sanctuary, we believe your goals and reflections are yours alone. We do not sell, trade, or monitor your personal data for advertising.

**What We Collect**

- **Identity:** Your email address is used solely for authentication and account recovery via Supabase.
- **Your Stones:** We store the titles of your Mountains and Pebbles (and related content you create) so you can access them across devices. This data is protected by Row Level Security (RLS), meaning only you can access the content associated with your unique account.

**Your Control**

- **Total Deletion:** If you choose to leave the Sanctuary, you can delete your account and all associated records from within the app settings. Deletion is immediate and applies to all data we store for your account.
- **Security:** All data is stored in secure, encrypted cloud environments managed by Supabase. Data in transit is protected by HTTPS/TLS.

**Contact**

For privacy-related questions, contact **support@voyagersanctuary.com**.

---

*Before store submission, confirm this inbox is monitored and matches the in-app / website contact.*

---

## 3. App Store — Privacy “Nutrition Label” (Apple)

When Apple asks for **Data Linked to You**, select:

| Data type | Selection | Notes |
|-----------|-----------|--------|
| **Contact info** | Email address | Auth and account recovery. |
| **User content** | Other user content | Mountains, Pebbles, intent statements. |
| **Usage data** | Product interaction | Used to power Whetstone streaks and momentum. |

**Data not shared with third parties** — declare that data is not sold or used for tracking; used only for app functionality and account management.

---

## 4. Checklist Before Submit

- [ ] Privacy Policy text finalized and published at a stable URL.
- [ ] Privacy Policy URL entered in Google Play Console and App Store Connect.
- [ ] Data Safety (Google) form completed using § 1.
- [ ] App Privacy (Apple) “Nutrition Label” completed using § 3.
- [ ] Account deletion flow tested (Settings → delete account) and documented in [RELEASE_CANDIDATE_SCRIPT.md](RELEASE_CANDIDATE_SCRIPT.md) or [TESTING_CHECKLIST.md](TESTING_CHECKLIST.md) if desired.

With this, you are ready to hit **Submit** on the consoles.
