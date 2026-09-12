# Durable task memory — NexMart product experience overhaul

Saved on 2026-09-12 from the user's full brief. This is the scope and acceptance criteria for the ongoing work. Resume from the actual working tree and the progress/verification record in `2026-09-11-product-experience-consolidation.md`; do not restart completed waves. The user explicitly requested: “find out what was the last finished work status in the codebase and complete the remainings. save this prompt in memory first.”

The original brief follows (the final testing code fence is closed for readability).

---

# NexMart — Full Production-Grade Product Experience, UI/UX, Responsive, Asset, Performance & Role-System Overhaul

You are the principal product designer, senior frontend architect, UX engineer, accessibility engineer, performance engineer, and production-quality reviewer responsible for the existing NexMart repository:

https://github.com/debmalyo-hub07/NexMart

Your task is to carefully transform the CURRENT NexMart implementation into a coherent, trustworthy, highly usable, production-grade e-commerce platform across all three roles:

- Customer / Shopper
- Admin / Store Operator
- Delivery Agent / Field Operator

This is NOT a request to rebuild NexMart from scratch.

This is NOT a request to blindly redesign every page.

This is NOT a request to add more animations.

This is NOT a request to replace existing architecture simply because another approach looks cleaner.

The repository has already gone through significant security, reliability, responsive, deployment, and UI remediation work. The current objective is to take what is already functioning and turn it into a genuinely mature product experience where design, usability, responsiveness, assets, information architecture, performance, accessibility, and operational workflows all work together.

The final product should feel like a real commercial e-commerce platform that users can trust with their accounts, addresses, orders and payments — while retaining NexMart's distinctive visual identity.

---

## IMPORTANT: CURRENT REPOSITORY REALITY

Before touching code, read the actual repository.

Read:

- `CLAUDE.md`
- `README.md`
- `docs/CHANGELOG.md`
- `docs/CONTRIBUTING.md`
- `docs/DEPLOYMENT.md`
- relevant files under `docs/superpowers/plans/`
- frontend package/dependency configuration
- backend package/dependency configuration
- frontend application routes
- frontend components
- frontend hooks
- frontend stores
- frontend API/client utilities
- frontend query configuration
- frontend styling/tokens
- backend routes
- controllers
- services
- models
- middleware
- configuration
- tests
- E2E/audit scripts
- CI workflow
- deployment files

Also inspect the latest Git history and the most recent commits before doing anything.

The repository has already received a major responsive/motion wave which, among other things, moved the homepage toward a commerce-first structure, removed excessive ProductCard interaction effects, gated WebGL more carefully, added a static poster path, improved mobile viewport behavior, improved error handling, strengthened request correlation, improved query retry policy, and added other reliability/security fixes.

Do NOT blindly repeat these changes.

Verify what exists now and build from that state.

The latest viewport fix also established canonical Next.js viewport metadata. Do not reintroduce duplicated viewport configuration.

The current repository should always be treated as the source of truth.

If `CLAUDE.md` and the source code disagree, inspect the source code, determine the real behavior, and update the documentation when appropriate.

---

# CORE OBJECTIVE

The objective is to make NexMart feel like:

> A trusted, modern, polished e-commerce platform that is exceptionally easy to understand and use.

Not:

> A visually impressive landing page with an e-commerce backend.

The product experience must communicate:

- clarity
- confidence
- consistency
- quality
- speed
- trust
- predictable interaction
- useful information
- responsive behavior
- operational maturity

The customer should think:

> “I know what this platform does.”

> “I know how to find what I need.”

> “I understand this product.”

> “I understand what I will pay.”

> “I know what happens after I order.”

The admin should think:

> “I can understand what needs attention.”

> “I can manage this store quickly.”

> “The data is trustworthy.”

The delivery agent should think:

> “I know what I need to do next.”

> “The app gets out of my way.”

---

# ABSOLUTE RULE: AUDIT FIRST

Before making substantive implementation changes, perform a complete product/UI/UX audit of the existing platform.

Do not immediately start rewriting components.

First inspect the system as a whole.

Do not judge a page in isolation.

Look at the relationship between:

- navigation
- pages
- components
- data
- interactions
- visual language
- role boundaries
- responsive behavior
- performance
- accessibility
- state handling

The platform should feel like one product, not a collection of pages created during different implementation waves.

---

# THE CURRENT PROBLEM TO SOLVE

The platform has already received many individual improvements, but the resulting UI still risks feeling like a sequence of incremental design passes layered on top of each other.

The current screenshots and implementation indicate that some parts are:

- visually strong but under-utilized
- technically improved but visually inconsistent
- spacious without clear purpose
- visually distinctive but not necessarily commerce-first
- functional but not yet polished
- responsive in isolation but not necessarily thoughtfully composed across all breakpoints
- using assets that may not yet form a consistent visual system

Therefore the next phase must be a CONSOLIDATION phase.

Do not ask:

> “What else can we add?”

Ask:

> “What should be simplified, reorganized, replaced, unified or removed?”

---

# PRODUCT DESIGN PHILOSOPHY

NexMart's existing visual direction, “Deep-Space Kinetic Editorial,” should remain recognizable.

However, the visual identity must serve commerce.

Use the following hierarchy:

Customer:

`Discovery → Information → Confidence → Action`

Admin:

`Information → Decision → Action`

Delivery:

`Task → Action → Confirmation`

Checkout:

`Clarity → Confidence → Completion`

Animation, gradients, visual effects and decorative assets are supporting elements.

They are never the primary purpose of a page.

---

# CUSTOMER EXPERIENCE

Re-evaluate the entire customer journey:

Home
→ Search
→ Categories
→ Product listing
→ Product detail
→ Cart
→ Checkout
→ Payment
→ Orders
→ Delivery tracking
→ Review / repeat purchase

Every transition between those surfaces must feel natural.

Do not make pages feel like unrelated mini-applications.

Shared branding is required.

Shared behavior should be used only where it actually improves usability.

---

# CUSTOMER HOMEPAGE — MAJOR PRIORITY

The homepage should be treated as the most important product-experience redesign.

The current homepage is already more commerce-oriented than earlier versions.

Do not revert it to the older highly animated implementation.

However, do not assume the current version is finished simply because it is now “commerce-first.”

Re-evaluate the homepage from the perspective of a normal shopper.

The visitor must immediately understand:

- what NexMart is
- what can be purchased
- where to search
- how to browse categories
- where products are
- why the platform feels trustworthy
- what action to take next

The homepage should NOT feel like:

- an Awwwards experiment
- a WebGL demonstration
- a branding microsite
- a startup landing page with products attached

It should feel like:

> a premium retail storefront

with a strong brand identity.

---

# HOMEPAGE HERO

Inspect the current hero implementation closely.

The current hero includes:

- large headline typography
- commerce messaging
- primary/secondary CTAs
- search
- a desktop featured-product area
- decorative visual background
- capability-gated WebGL/static poster behavior

Determine whether these elements work together as one composition.

Do not preserve the current composition merely because it already exists.

Evaluate:

- hierarchy
- density
- balance
- readability
- product emphasis
- search prominence
- CTA prominence
- visual noise
- vertical space
- responsive behavior
- trust perception

The most important elements should visually dominate:

1. brand/value proposition
2. search/discovery
3. shopping action
4. actual products

The decorative visual should support them.

---

# HOMEPAGE HERO VISUAL

The abstract 3D scene should NOT automatically be the visual centerpiece.

Consider whether the hero would be stronger with:

- real product imagery
- curated product composition
- a product collage
- a category composition
- restrained brand geometry
- carefully art-directed abstract visual language
- a combination of real product imagery and subtle brand geometry

Research modern commerce landing pages and determine which direction gives NexMart the strongest balance between:

- identity
- trust
- usability
- product discovery
- performance

Do not simply copy another company.

Use their underlying design principles.

---

# THREE.JS STRATEGY

Three.js is permitted but must justify its cost.

The existing implementation already has safeguards such as:

- capability detection
- mobile fallback
- reduced-motion fallback
- weak-device fallback
- visibility-based pausing
- disposal

Preserve those protections.

Do not reintroduce continuous WebGL on small mobile devices for visual decoration.

Do not make WebGL required for understanding or navigation.

For capable desktop devices, determine whether the scene is visually useful enough to keep.

If it is retained:

- reduce unnecessary geometric complexity
- minimize rendering cost
- avoid excessive particles
- ensure text remains dominant
- avoid visual competition with product imagery
- pause when unnecessary
- maintain proper disposal
- avoid hydration problems

If the visual contribution is not worth the complexity, replace it with a lower-cost visual system.

---

# MOBILE EXPERIENCE

Mobile is NOT a reduced desktop.

Mobile requires deliberate composition.

Test and reason about:

- 320px
- 360px
- 375px
- 390px
- 414px
- 430px

Also test tablet and desktop widths.

The design must adapt based on user context, not merely scale dimensions.

---

# MOBILE HOMEPAGE

The first screen should provide an obvious shopping path.

The user should be able to see or reach:

- brand identity
- concise value proposition
- search
- browse action
- category discovery
- products

Do not consume most of the first screen with decorative space.

Do not make the user scroll through a giant cinematic experience before seeing commerce.

Do not make important buttons appear only after a long animation.

Do not force users to understand an animation before understanding the product.

---

# MOBILE VIEWPORT

Audit:

- `svh`
- `dvh`
- safe area
- fixed header
- browser UI behavior
- keyboard behavior
- sticky sections
- dialogs
- drawers
- scroll containers

Ensure:

- no horizontal overflow
- no clipped buttons
- no content underneath fixed navigation
- no unexpected viewport jumps
- no `100vh` assumptions that break mobile browsing
- no body scroll locking bugs

---

# MOBILE NAVIGATION

Navigation should make shopping easy.

Prioritize:

- search
- products
- categories
- cart
- account

The menu should:

- open immediately
- close predictably
- trap focus correctly
- support Escape
- lock background scroll safely
- remain usable on small screens
- respect safe areas

Do not turn the mobile drawer into a giant animated presentation.

---

# SEARCH

Search is one of the core commerce functions.

Treat it as a product feature, not just a text input.

Audit:

- desktop placement
- mobile placement
- keyboard behavior
- autocomplete
- categories
- products
- recent searches
- typo handling
- loading
- empty
- errors
- clear button
- keyboard navigation
- result ordering
- request cancellation
- stale-result protection

Search should be easy to reach immediately after landing.

---

# CATEGORIES

Categories should create a mental map of the catalog.

The current category system should be audited for:

- labels
- iconography
- visual consistency
- density
- hierarchy
- touch targets
- responsiveness
- color use

Avoid random category colors just for visual variety.

Do not mix arbitrary emoji, icons and illustrations without a coherent visual language.

If categories use icons from backend data, establish a consistent presentation system.

---

# PRODUCT DISCOVERY

The platform should make browsing feel effortless.

Audit:

- category pages
- product listing
- search results
- filters
- sorting
- pagination
- mobile filter UI
- product cards
- loading
- empty
- errors
- out-of-stock states

The user should be able to compare products without opening every product page.

---

# PRODUCT CARDS

The latest ProductCard already removed earlier excessive behaviors such as:

- 3D tilt
- pointer tracking glow
- quick-view hover overlay
- confetti

Do not reintroduce these merely because they look impressive.

The card should prioritize:

- image
- brand/category
- title
- rating
- price
- compare price/MRP
- discount
- availability
- wishlist
- add to cart

The exact visual ordering can be improved if research supports it.

---

# PRODUCT CARD INTERACTION

Desktop may use subtle hover enhancement.

Touch must not require hover.

Essential information must always be accessible.

Do not:

- hide important information behind hover
- require tapping twice to reveal actions
- move cards unexpectedly
- make buttons difficult to hit
- create accidental product navigation from action buttons

All touch actions should meet appropriate minimum target sizes.

---

# PRODUCT IMAGE STRATEGY

Product imagery is one of the biggest opportunities for perceived quality.

Audit the actual assets currently in the catalog.

Look for:

- inconsistent aspect ratios
- inconsistent backgrounds
- poor crops
- inconsistent object size
- blurry images
- excessive whitespace
- inconsistent lighting
- embedded text
- inconsistent branding

Establish a clear NexMart product-image standard.

For most products prefer:

- clean presentation
- consistent crop
- product clearly visible
- neutral or category-appropriate background
- high enough resolution
- optimized delivery

Do not simply download random stock images.

---

# ASSET RESEARCH

Research high-quality sources for:

- product imagery conventions
- iconography
- illustrations
- UI references
- design systems
- e-commerce visual merchandising

Use resources from appropriate legitimate sources.

Do not use:

- copyrighted assets without proper permission
- watermarked assets
- random stock imagery merely because it fills space
- inconsistent AI-generated imagery
- fake customer photography
- fake testimonials

Where real catalog assets are available, prioritize them.

---

# HERO ASSET STRATEGY

The hero visual should be intentionally art-directed.

Potential directions should be evaluated rather than assumed:

- real catalog product
- product group
- product/category collage
- abstract brand system
- restrained orbital geometry
- high-end editorial composition

Choose one coherent strategy.

Do not combine five unrelated styles.

---

# TRUST DESIGN

Trust should come from actual functionality.

Useful trust signals may include real:

- payment methods
- delivery information
- return policy
- order tracking
- verified purchase reviews
- stock availability
- payment state
- invoice availability
- customer support

Never fabricate:

- customer counts
- satisfaction percentage
- number of cities
- delivery success percentage
- popularity metrics
- testimonials

If a statistic is not backed by data, remove it.

---

# ABOUT PAGE

The current About page should be treated as a trust surface.

Audit all claims and metrics.

If data is not authoritative, remove it.

The page should explain:

- what NexMart is
- why it exists
- what it values
- how it approaches commerce
- how users benefit

It should feel credible, not exaggerated.

---

# FOOTER

Audit every footer item.

Verify every:

- Shop link
- Support link
- Account link
- Order link
- Policy link
- Company link
- social link
- contact detail

No dead links.

No placeholder information.

No fictional phone numbers.

No misleading business claims.

The footer should reinforce trust.

---

# CUSTOMER PRODUCT DETAIL

This should be one of the strongest pages in the application.

The customer must understand:

- product name
- brand
- image gallery
- variants
- price
- discount
- availability
- specifications
- reviews
- delivery information
- return/refund information
- add-to-cart action
- purchase action where appropriate

The information architecture should reduce uncertainty.

Avoid decorative layouts that push useful information too far down the page.

---

# PRODUCT DETAIL IMAGERY

Use a professional gallery:

- consistent aspect ratio
- obvious selected image
- touch-friendly mobile behavior
- accessible thumbnails
- zoom only when useful
- no layout jumps
- optimized image loading

Do not make the gallery feel like an art portfolio.

The user is trying to inspect a product.

---

# PRICE AND PURCHASE

Price should have obvious visual priority.

Clearly distinguish:

- selling price
- MRP
- discount
- taxes where appropriate
- shipping
- final payable amount

Do not visually hide the actual cost.

---

# INVENTORY COMMUNICATION

Use real inventory state.

Clearly communicate:

- in stock
- low stock only if backed by real thresholds
- out of stock
- unavailable variant

Do not fabricate scarcity.

---

# CART

The cart should communicate exactly what the customer is buying.

Display clearly:

- product
- variant
- quantity
- item price
- discounts
- subtotal
- shipping
- tax
- total

Handle:

- stock changes
- price changes
- removed products
- unavailable variants
- expired sessions
- network failure

Never silently change the customer's order.

---

# CHECKOUT

Checkout must be deliberately calmer than the homepage.

Reduce decorative motion.

Prioritize:

- address
- order summary
- payment method
- final total
- completion action

The user should always understand:

- what they are paying
- where the order is going
- which payment method they selected
- what happens after clicking the final button

---

# PAYMENT UI

The interface must differentiate:

- payment starting
- payment window/opening
- payment pending
- verification
- success
- failure
- cancellation
- uncertain/network interruption
- retry

Never leave the customer wondering whether they were charged.

Do not hide state inside generic toast messages alone when the state affects the order.

---

# ORDER EXPERIENCE

Order history should feel reliable and transparent.

Users need:

- order ID
- date
- amount
- payment state
- fulfillment state
- product summary
- delivery state
- invoice
- detail access

Order detail should show a clear lifecycle.

Example:

Placed
→ Confirmed
→ Shipped
→ Out for delivery
→ Delivered

Cancellation, return and refund should be represented as distinct concepts.

---

# ORDER TRACKING

Realtime updates are useful but not sufficient on their own.

Keep appropriate polling/refetch backstops.

When the socket disconnects:

- the page must still work
- state should eventually refresh
- user should not see stale false confidence

---

# CUSTOMER REVIEWS

Reviews must look trustworthy.

Audit:

- verified purchase
- rating
- text
- date
- moderation
- duplicate review prevention
- XSS safety
- loading/error/empty

Do not display untrusted HTML.

Render user-generated content safely.

---

# CUSTOMER ACCOUNT

Account pages should share the brand but become more functional.

Audit:

- profile
- address
- password
- wishlist
- orders
- invoices

Use consistent forms, spacing, feedback and error handling.

---

# ADMIN PRODUCT PHILOSOPHY

Admin is not a customer-facing marketing experience.

The admin interface must optimize:

- speed
- information density
- accuracy
- scanability
- safe actions
- confidence

Avoid unnecessary visual spectacle.

---

# ADMIN DASHBOARD

The current dashboard already uses real backend data and controlled synchronization.

Preserve that principle.

Improve:

- information hierarchy
- urgency
- metric interpretation
- chart readability
- recent order visibility
- mobile layout
- operational shortcuts

The dashboard should answer:

> What is happening?

> What requires attention?

> What should I do next?

---

# ADMIN TABLE DESIGN

Desktop:

- compact
- scannable
- sortable
- filterable

Mobile:

- purpose-built card/row presentation
- essential information first
- detail expansion
- actions easily reachable

Do not shrink a desktop table until it becomes unusable.

---

# ADMIN PRODUCT MANAGEMENT

Reorganize complex forms into logical groups.

Example:

Basic information
→ Category
→ Pricing
→ Inventory
→ Variants
→ Images
→ Publishing
→ SEO

Every field should have:

- label
- useful hint where necessary
- validation
- server error
- loading state
- save state

Destructive actions require confirmation.

---

# ADMIN ORDER MANAGEMENT

Make these obvious:

- order ID
- customer
- total
- payment state
- fulfillment state
- delivery assignment
- timestamps

Actions must communicate the actual consequence.

Do not rely on ambiguous icon-only actions.

---

# ADMIN REFUNDS

Clearly distinguish:

Order status

from

Payment status

Example:

Order:

`Delivered`

Payment:

`Refunded`

Do not describe a refunded order as cancelled unless it actually was cancelled.

---

# ADMIN USERS

Customer administration should make:

- active
- suspended
- status changes
- account state

obvious.

Avoid accidental destructive actions.

Use confirmation for state changes where appropriate.

---

# DELIVERY PRODUCT PHILOSOPHY

Delivery should feel like an operational field application.

Do not give the delivery dashboard the same visual density or motion as the customer homepage.

Prioritize:

- assignment
- order
- address
- customer
- contact
- navigation
- next status
- confirmation

---

# DELIVERY ACTION MODEL

The current system has a forward-only order transition graph.

Preserve that.

Evaluate whether a generic status dropdown is the best interaction.

A more usable pattern may be:

Current:

`Confirmed`

Next action:

`Mark as picked`

Then:

`Picked`

Next action:

`Mark out for delivery`

Then:

`Out for delivery`

Next action:

`Mark delivered`

Only implement this when it integrates cleanly with the existing server-side state machine.

Never allow invalid transitions.

---

# DELIVERY MOBILE

Optimize for:

- 375px+
- one-handed use
- outdoor usage
- poor network
- quick scanning
- large targets
- obvious status
- safe action feedback

Important delivery controls should preferably be approximately 48px or larger.

---

# DELIVERY CONNECTIVITY

Test:

- request timeout
- offline mode
- socket disconnect
- duplicate tap
- response lost after server success
- retry

The user must understand whether the action was completed.

Never create duplicate state transitions.

---

# DESIGN SYSTEM CONSOLIDATION

The most important architectural goal is to prevent each page from inventing its own visual language.

Create and enforce consistent primitives for:

- buttons
- inputs
- selects
- cards
- badges
- status
- tables
- dialogs
- drawers
- skeletons
- toasts
- page headers
- section headings
- empty states
- error states

Reuse these across roles where appropriate.

---

# SURFACE SYSTEM

Maintain a controlled hierarchy:

- page
- section
- card
- raised/elevated card
- overlay

Avoid excessive rounded containers.

Not every block needs to become a “glass card.”

Use surface changes only when they communicate hierarchy.

---

# COLOR SYSTEM

Use the existing brand palette deliberately.

Violet:

- brand
- primary interaction
- active state

Acid green:

- success
- positive action
- available/in-stock state where appropriate

Amber:

- warning
- pending

Red:

- danger
- error
- cancellation

Neutral:

- most content

Do not color every component merely for decoration.

---

# TYPOGRAPHY

Standardize:

- display
- page heading
- section heading
- body
- metadata
- data/monospace

Ensure typography remains readable at small widths.

Avoid oversized headings that dominate the screen while useful information becomes difficult to reach.

---

# SPACING

Use consistent spacing across the entire platform.

Audit:

- section spacing
- card padding
- button spacing
- form gaps
- table rows
- mobile gutters
- desktop page width

Avoid unexplained giant gaps.

Negative space should communicate hierarchy, not incomplete implementation.

---

# ICONOGRAPHY

Use a coherent icon family.

Prefer the existing icon system where possible.

Do not mix:

- emoji
- random SVGs
- mismatched icon families
- inconsistent weights

unless there is an explicit semantic reason.

---

# MOTION SYSTEM

Motion needs one clear policy.

Customer desktop:

- subtle editorial motion
- product feedback
- restrained hover

Customer mobile:

- minimal feedback motion

Checkout:

- almost no decorative motion

Authentication:

- minimal

Admin:

- state feedback
- dialogs
- skeletons
- small transitions

Delivery:

- state feedback
- assignment feedback
- loading

---

# MOTION RULE

Every animation must have a reason.

It should:

- communicate state
- guide attention
- explain relationship
- provide feedback
- strengthen brand without interfering with the task

Do not animate merely because the framework supports animation.

---

# REDUCED MOTION

For:

`prefers-reduced-motion: reduce`

meaningfully reduce:

- parallax
- continuous movement
- large transforms
- decorative motion
- rotating scenes

The page must remain polished and understandable without animation.

---

# HOVER

Hover is enhancement, not functionality.

Essential information and actions must work on:

- mouse
- keyboard
- touch

---

# RESPONSIVE DESIGN

Responsive layouts must be intentional.

Do not merely shrink desktop components.

Use:

- fluid widths
- CSS grid/flex
- intrinsic sizing
- `clamp`
- deliberate breakpoint changes

Keep the breakpoint system understandable.

Do not create breakpoint spaghetti.

---

# PERFORMANCE

Treat performance as part of product design.

Measure:

- LCP
- INP
- CLS
- JavaScript cost
- hydration cost
- image size
- font loading
- long tasks
- rendering cost
- scroll performance
- WebGL cost

Do not use only Lighthouse screenshots as proof.

Also inspect actual browser performance tooling.

---

# MOBILE PERFORMANCE

The mobile experience must remain usable on realistic mid-range/low-power devices.

Consider:

- CPU
- GPU
- memory
- network
- browser UI
- image decoding

A desktop-class machine is not the baseline.

---

# WEBGL PERFORMANCE

For capable desktop devices evaluate:

- DPR
- particle count
- geometry count
- draw cost
- material cost
- render frequency
- tab visibility
- intersection visibility

Do not let WebGL consume resources when the visual is not being viewed.

---

# JAVASCRIPT PERFORMANCE

Audit client components.

Look for:

- unnecessary `'use client'`
- large client boundaries
- unnecessary effects
- repeated renders
- duplicated state
- pointer handlers
- scroll handlers
- unnecessary intervals

Prefer server rendering where practical.

Do not turn an entire page into a client component just because one small component requires interaction.

---

# DATA FETCHING

Preserve TanStack Query for server state.

Avoid unnecessary duplication between:

- React Query
- Zustand
- raw component state

Do not create competing sources of truth.

Use Zustand primarily for:

- client UI state
- local interaction state
- deliberately client-owned cart state

---

# QUERY UX

Every server-driven section must differentiate:

Loading

Error

Empty

Success

Unauthorized

Offline where relevant

Do not display fake zero values.

Do not display “No items” when the API actually failed.

---

# API ERROR UX

Translate technical failures into useful UI language.

Never expose:

- stack traces
- Mongo errors
- Razorpay internals
- filesystem paths
- secrets

The user needs to know:

- what happened
- whether their previous state remains safe
- what action to take

---

# IMAGE OPTIMIZATION

Audit all Next.js image usage.

Ensure:

- correct `sizes`
- appropriate priority
- lazy loading where appropriate
- stable aspect ratios
- optimized Cloudinary delivery
- no unnecessary large downloads

Decorative imagery should not compete with primary product content.

---

# SEARCH PERFORMANCE

Search should:

- debounce
- cancel stale requests
- avoid duplicate calls
- preserve current result ordering
- recover from errors
- work well on mobile

---

# ACCESSIBILITY

Target WCAG 2.2 AA for the important user journeys.

Audit:

- keyboard navigation
- focus
- dialog focus trapping
- Escape
- screen-reader labels
- semantic headings
- form labels
- errors
- contrast
- touch target sizes
- reduced motion
- status semantics

Status must never rely on color alone.

Use:

`icon + text + color`

where appropriate.

---

# CONTENT QUALITY

Treat UI copy as part of UX.

Use copy that is:

- specific
- calm
- direct
- honest

Avoid vague language.

Bad:

`Something went wrong.`

Better:

`We couldn't update your order. Your previous status is unchanged. Try again.`

Bad:

`Amazing shopping experience.`

Better:

Use factual product/service information.

---

# TRUST AND AUTHENTICITY AUDIT

Search the entire application for claims such as:

- millions of products
- thousands of shoppers
- 99% satisfaction
- 98% delivery rate
- same-day delivery
- every city
- best prices
- trusted by millions

Determine whether each statement is:

- real and data-backed
- real but needs dynamic data
- marketing language
- unsupported
- false

Remove unsupported factual claims.

---

# REAL DATA ONLY

Never create:

- fake testimonials
- fake reviews
- fake analytics
- fake customers
- fake order history
- fake activity
- fake statistics

If the platform does not yet have data:

show an honest empty state.

---

# PRODUCT ASSET POLICY

Do not add fake products merely to make the homepage look fuller.

Use the real product catalog.

When content is sparse:

- improve layout
- improve messaging
- improve category discovery

Do not create artificial data.

---

# ROLE-SPECIFIC DESIGN SYSTEM

The three experiences should feel like siblings.

They should share:

- brand
- logo
- typography
- semantic colors
- icon system
- component foundation

But they should differ in:

- density
- navigation
- motion
- task structure
- information hierarchy

Customer:

premium retail experience.

Admin:

operations control center.

Delivery:

field task application.

---

# VISUAL CONSISTENCY AUDIT

Search for:

- old color values
- deprecated gradients
- inconsistent border opacity
- inconsistent typography classes
- old font classes
- arbitrary rounded sizes
- inconsistent button sizes
- different page gutters
- inconsistent headings
- inconsistent empty states
- inconsistent error states
- duplicate component implementations

Consolidate rather than adding another variant.

---

# RESPONSIVE QA

Check every major surface at:

- 320px
- 360px
- 375px
- 390px
- 414px
- 430px
- 768px
- 820px
- 1024px
- 1280px
- 1440px
- 1920px

Test for:

- overflow
- clipping
- broken wrapping
- bad whitespace
- unreachable actions
- fixed-position conflicts
- oversized typography
- insufficient touch areas

---

# BROWSER QA

Where practical test:

- Chromium
- WebKit/Safari-class behavior
- Firefox

Also test:

- mouse
- touch
- keyboard
- reduced motion

---

# VISUAL REGRESSION

Before and after major changes, capture representative screenshots for:

Customer:

- home
- products
- search
- product detail
- cart
- checkout
- orders

Admin:

- dashboard
- products
- product form
- orders
- users
- analytics

Delivery:

- dashboard
- assigned order
- status update state

Review screenshots for:

- hierarchy
- density
- consistency
- clipping
- spacing
- color
- typography
- assets
- motion

---

# REAL DATA STRESS TESTING

Do not test only ideal data.

Test:

- very long product name
- short product name
- missing image
- many images
- no reviews
- many reviews
- out of stock
- discount
- no discount
- expensive product
- multiple variants
- long address
- inactive category
- API failure
- empty API response
- slow API response

---

# USER-FLOW TESTING

Customer:

Home
→ search
→ product
→ variant
→ add to cart
→ cart
→ checkout
→ payment
→ order
→ tracking

Admin:

Login
→ dashboard
→ inspect order
→ update order
→ assign delivery
→ inspect customer
→ product management
→ analytics

Delivery:

Login
→ assigned order
→ address
→ contact
→ status update
→ delivered

Test both success and failure paths.

---

# FAILURE TESTING

Simulate:

- slow API
- API timeout
- network loss
- backend restart
- Redis unavailable
- payment unavailable
- payment timeout
- socket disconnect
- duplicate click
- browser refresh
- browser back navigation
- expired session
- stale page state

The UI must fail predictably.

---

# SECURITY REGRESSION

Do not accidentally weaken existing security.

Verify:

- role isolation
- authorization
- ownership
- session expiration
- suspension
- CSRF
- rate limits
- server-side prices
- server-side stock
- payment verification
- webhook verification
- safe user-generated content

Any UI-driven API change must preserve these guarantees.

---

# BACKEND MODIFICATION POLICY

Prefer frontend and design-system changes.

Do not alter backend business behavior without evidence that it is required.

If a backend change becomes necessary:

- identify the exact reason
- make the smallest correct change
- add/update tests
- verify E2E behavior
- update documentation

Never rewrite backend systems merely to make frontend code look cleaner.

---

# IMPLEMENTATION ORDER

Work carefully in waves.

## Wave 1

Audit and consolidate design tokens/components.

## Wave 2

Customer navigation + homepage.

## Wave 3

Search + categories + product discovery.

## Wave 4

Product detail + cart + checkout.

## Wave 5

Orders + account + trust surfaces.

## Wave 6

Admin experience.

## Wave 7

Delivery experience.

## Wave 8

Accessibility + performance.

## Wave 9

Visual regression + cross-role consistency + cleanup.

Do not modify the entire application simultaneously.

---

# PLAN FILES

For any work larger than a small isolated change, create:

`docs/superpowers/plans/YYYY-MM-DD-<topic>.md`

The plan should explain:

- problem
- current state
- design objective
- implementation
- files
- risks
- tests
- verification

---

# TESTING REQUIREMENTS

After implementation:

```bash
cd frontend
npm ci
npm test
npm run lint
npm run build
```
