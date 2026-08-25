# HiveMint Launchpad

Build an MVP frontend prototype for a Hive-native NFT launchpad and marketplace called "HiveMint".

IMPORTANT:
- This is ONLY an MVP prototype.
- Use MOCK DATA ONLY.
- Do NOT connect to Hive blockchain yet.
- Do NOT use DHive yet.
- Do NOT use Hive Keychain yet.
- Do NOT connect MongoDB, Supabase, Firebase, or any backend.
- All interactions must work locally in the browser using Zustand.
- Structure the code so real Hive/DHive/Keychain/backend services can be added later without rewriting the UI.
- Use TypeScript.
- Use React.
- Use Zustand for ALL application state.
- Do not use Redux.
- Do not create unnecessary backend/API infrastructure.

PRODUCT CONCEPT:

HiveMint is a Hive NFT launchpad and marketplace.

Creators can create NFT collections through the platform.

For the real product:
1. Creator pays HIVE to create a collection.
2. Platform owns/controls the shared Hive Engine NFT infrastructure.
3. Users pay HIVE to mint.
4. Platform randomly selects an NFT from the collection.
5. Platform mints the NFT and sends it to the user's Hive account.
6. Platform sends the creator their share and keeps a platform fee.
7. Users can later sell their NFTs through the native Hive NFT marketplace.
8. Platform acts as the broker/infrastructure layer and can earn a secondary-market fee.
9. Hive is intended to be the payment currency.
10. MongoDB will eventually be used as the indexing/application database.

For this MVP, simulate all of these operations with mock data.

DESIGN:

Create a polished modern Web3 marketplace UI, but avoid the typical overly flashy crypto aesthetic.

Use:
- dark interface
- clean cards
- strong typography
- subtle borders
- rounded corners
- tasteful gradients
- NFT artwork as visual focus
- responsive desktop-first layout
- mobile responsive
- professional marketplace/dashboard feel

Use mock NFT artwork from generated gradients, placeholder images, or remote placeholder image URLs. Do not depend on external APIs.

APP STRUCTURE:

1. DASHBOARD

Show:

- Total Collections
- NFTs Minted
- HIVE Volume
- Active Listings
- Recent Activity
- Trending Collections
- Recent Mints

Example mock statistics:

Collections: 24
NFTs Minted: 18,492
HIVE Volume: 84,250 HIVE
Active Listings: 1,284

Include a prominent hero section:

"Hive NFT Launchpad"
"Create collections. Mint NFTs. Trade on Hive."

Buttons:
- Explore Collections
- Create Collection

2. COLLECTIONS PAGE

Grid of mock collections.

Each card contains:
- collection image
- collection name
- creator
- total supply
- minted
- mint price
- floor price
- status
- rarity information

Example collections:

CryptoCore Genesis
Lucky Frogs
Pixel Warriors
Hive Legends
Cyber Hive
Genesis Beasts

Filters:
- All
- Minting
- Sold Out
- Trending

Sort:
- Trending
- Newest
- Floor Price
- Volume

3. COLLECTION DETAIL

Create a detailed collection page.

Header:
- large collection artwork
- collection name
- creator
- description
- supply
- minted
- mint price
- floor price
- volume
- holders

Main CTA:
"MINT NFT"

Show rarity distribution:

Common 70%
Rare 20%
Epic 8%
Legendary 2%

Show sample NFT cards from the collection.

Include:
- About
- NFTs
- Activity

4. MINT MODAL

When clicking MINT NFT:

Show:

Collection:
CryptoCore Genesis

Mint price:
5.00 HIVE

Platform fee:
0.25 HIVE

Total:
5.25 HIVE

Button:
"Confirm Mint"

Because this is mock mode, clicking Confirm Mint should:

- simulate a transaction
- show a loading state
- randomly select an available NFT
- add the NFT to the user's My NFTs
- increase collection minted count
- decrease available supply
- add activity event
- add mock transaction ID
- show success modal

Success screen:

"NFT Minted!"

Display:
- NFT artwork
- NFT name
- token number
- rarity
- mock transaction ID

Buttons:
- View NFT
- View My NFTs

5. MY NFTs

Show the currently connected mock user's NFTs.

Use mock user:

@alice

Wallet balance:
125.50 HIVE

NFT grid.

Each NFT card:
- image
- collection
- name
- token ID
- rarity
- estimated value
- ownership

Filters:
- All
- Collection
- Rarity

6. NFT DETAIL

Show:

NFT artwork
Collection
NFT name
Token ID
Owner
Rarity
Mint number
Mint date
Estimated value

Metadata section:

Name
Description
Attributes

Example:

Name: Legendary Miner
Mint: #1842
Max Supply: 5000

Attributes:
Rarity: Legendary
Power: 95
Type: Mining Rig
Generation: 1

Show blockchain section:

Network: Hive
NFT Standard: Hive Engine NFT
Collection: CryptoCore Genesis
Token ID: 1842

For MVP these are mock values.

Actions:
- List for Sale
- Transfer
- View Activity

7. LIST NFT

Create a modal/page for listing an NFT.

Fields:

Price:
[ 50.00 ]

Currency:
HIVE

Marketplace Fee:
2.5%

Estimated Receive:
48.75 HIVE

Button:
"List NFT"

Since this is mock:
- mark NFT as listed
- add marketplace listing
- add activity
- show success state

8. MARKETPLACE

Create a marketplace page.

Sections:
- Featured
- Trending
- Recently Listed
- Recently Sold

NFT cards show:

Artwork
NFT name
Collection
Rarity
Seller
Price in HIVE
Time listed

Example:

Legendary Miner #1842
CryptoCore Genesis
Legendary
50 HIVE

Button:
BUY

When BUY is clicked:

Show confirmation modal:

NFT:
Legendary Miner #1842

Price:
50 HIVE

Marketplace fee:
1.25 HIVE

Total:
51.25 HIVE

Button:
Confirm Purchase

Mock purchase behavior:
- deduct HIVE from @alice
- transfer NFT ownership to @alice
- remove listing
- add sale transaction
- add activity
- update seller balance
- update marketplace volume

9. ACTIVITY

Global activity feed.

Types:

Minted
Listed
Sold
Transferred
Collection Created

Example:

@alice minted Legendary Miner #1842
5 HIVE
2 minutes ago

@bob listed Pixel Warrior #391
25 HIVE
5 minutes ago

@alice purchased Cyber Beast #72
80 HIVE
12 minutes ago

10. CREATE COLLECTION

Create a creator-facing collection creation form.

Fields:

Collection Name
Description
Collection Image
Total Supply
Mint Price
Creator Fee
Platform Fee
Rarity Configuration
Metadata Base URI

Show a live preview.

Rarity configuration:

Common
Rare
Epic
Legendary

Allow percentages to be edited.

Example default:

Common 70
Rare 20
Epic 8
Legendary 2

Show:

Total = 100%

Button:
"Create Collection"

In mock mode:
- create collection in Zustand
- assign mock collection ID
- add creator as @alice
- deduct mock collection creation fee from HIVE balance
- show success screen

11. CREATOR DASHBOARD

Create a creator dashboard for @alice.

Show:

Collections
NFTs Minted
Primary Sales
Secondary Volume
Creator Earnings
Pending Earnings

Collection cards.

For each collection:
- minted
- supply
- revenue
- floor price
- volume

12. WALLET

Top navigation should have a mock connected wallet:

@alice
125.50 HIVE

Clicking it opens a wallet dropdown:

Account
Balance
My NFTs
Activity
Disconnect

Disconnect should simply switch to a mock disconnected state.

Provide a "Connect Hive Wallet" button when disconnected.

For MVP this should simulate connection.

ZUSTAND STATE:

Create a centralized Zustand store.

Suggested structure:

useAppStore

State:

user
walletConnected
hiveBalance
collections
nfts
listings
transactions
activities

Actions:

connectWallet()
disconnectWallet()

createCollection()
mintNFT()
listNFT()
cancelListing()
buyNFT()
transferNFT()

addActivity()

updateBalance()

selectRandomNFT()

Use TypeScript interfaces/types for:

User
Collection
NFT
Listing
Transaction
Activity
Rarity
CollectionSettings

NFT MODEL:

Each NFT should contain:

id
collectionId
collectionName
tokenId
name
description
image
rarity
mintNumber
maxSupply
owner
attributes
metadataUri
estimatedValue
createdAt
status

COLLECTION MODEL:

id
name
symbol
creator
description
image
maxSupply
minted
mintPrice
creatorFee
platformFee
rarities
status
createdAt

IMPORTANT NFT LOGIC:

Mock minting must actually select a random NFT based on rarity configuration.

For example:

Common = 70%
Rare = 20%
Epic = 8%
Legendary = 2%

Generate a deterministic mock NFT from the collection's predefined supply.

Do not actually generate blockchain transactions.

Generate mock transaction IDs such as:

MOCK-HIVE-7F82A91C

DATABASE ARCHITECTURE:

Create a clean abstraction layer even though we are using local Zustand storage now.

Create placeholder service interfaces:

HiveService
DatabaseService
MarketplaceService

For now:

MockHiveService
MockDatabaseService
MockMarketplaceService

Do NOT implement real Hive functionality yet.

The future architecture will be:

Frontend
 ↓
Game/NFT SDK
 ↓
API
 ↓
Hive Service
 ↓
DHive / Hive Engine
 ↓
Hive Blockchain

and:

API
 ↓
Database Service
 ↓
MongoDB

The frontend should never directly depend on MongoDB.

ROUTING:

Use React Router.

Routes:

/
 /collections
 /collections/:id
 /mint/:collectionId
 /marketplace
 /nfts
 /nfts/:id
 /activity
 /creator
 /creator/collections
 /creator/collections/new

COMPONENTS:

Create reusable components:

Navbar
WalletButton
NFTCard
CollectionCard
StatCard
MintModal
PurchaseModal
ListingModal
CreateCollectionForm
RarityChart
ActivityFeed
MarketplaceFilters
NFTGrid
CollectionHeader
MetadataPanel
TransactionStatus
EmptyState
LoadingState

MOCK DATA:

Seed at least:

8 collections
50+ NFTs
20+ marketplace listings
30+ activity records
10+ transactions

Make the data internally consistent.

The currently connected user should be @alice.

Include NFTs owned by @alice so the My NFTs page is populated.

Include other users:
@bob
@charlie
@david
@eve

IMPORTANT:

The entire prototype should feel like a real working product, not a static design.

All important buttons should work using Zustand state.

Refreshing the page should preserve mock state using Zustand persist/localStorage.

Do not add authentication.

Do not add a backend.

Do not add real blockchain calls.

Do not use Firebase/Supabase/MongoDB yet.

Do not use placeholder TODO screens.

Make the MVP visually polished and fully navigable.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/f8166a7a-6dbf-4391-9070-7d9ccdbf1f0e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
