# API Client Versioning Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rails can classify each request as legacy native, offline-first native, or current web from `X-Fintr-*` headers, and advertise per-platform cutoffs on `GET /api/v1/cache_version`, without forking live-GET JSON or adding `/api/v2`.

**Architecture:** Parse headers into `Api::ClientIdentity` on every request (`Current.client`). `Api::ClientVersionPolicy` compares native marketing versions to `config/client_version_policy.yml` (web is always current). Public `cache_version` grows an additive `api` object. No serializer or HTTP 426 changes in this slice.

**Tech Stack:** Rails 8 API, RSpec request + lib specs, `Rails.application.config_for`, `Gem::Version`, existing `ApiResponses` camelCase.

**Spec:** `docs/superpowers/specs/2026-08-27-api-client-versioning-design.md`

**Working directory for Ruby commands:** `apps/fintr-be`

---

## File map

| File | Responsibility |
|------|----------------|
| `apps/fintr-be/lib/api/client_identity.rb` | `Api::ClientIdentity` data object |
| `apps/fintr-be/lib/api/client_identity_parser.rb` | Headers + User-Agent → identity |
| `apps/fintr-be/lib/api/client_version_policy.rb` | `legacy?` / `offline_first?` / `unsupported?` + discovery hash |
| `apps/fintr-be/config/client_version_policy.yml` | Per-platform cutoffs (`null` until first offline-first store build) |
| `apps/fintr-be/app/controllers/concerns/assign_client_identity.rb` | `prepend_before_action` → `Current.client` |
| `apps/fintr-be/app/models/current.rb` | `attribute :client` |
| `apps/fintr-be/app/controllers/application_controller.rb` | Include the concern |
| `apps/fintr-be/app/controllers/api/v1/cache_version_controller.rb` | Merge discovery payload |
| `apps/fintr-be/config/initializers/cors.rb` | Allow the three request headers |
| `docs/API_REQUEST_PARAMETERS.md` | Identity is headers, not body params |

Do **not** change live-GET controllers, serializers, admin cache endpoints, or add `/api/v2`.

---

### Task 1: Parse client identity from headers

**Files:**
- Create: `apps/fintr-be/spec/lib/api/client_identity_parser_spec.rb`
- Create: `apps/fintr-be/lib/api/client_identity.rb`
- Create: `apps/fintr-be/lib/api/client_identity_parser.rb`

- [ ] **Step 1: Write the failing parser spec**

Create `apps/fintr-be/spec/lib/api/client_identity_parser_spec.rb`:

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::ClientIdentityParser do
  def parse(headers: {}, user_agent: nil)
    request = ActionDispatch::TestRequest.create
    headers.each do |key, value|
      request.headers[key] = value
    end
    request.headers["User-Agent"] = user_agent if user_agent
    described_class.call(request:)
  end

  describe "platform" do
    it "accepts web" do
      identity = parse(headers: { "X-Fintr-Platform" => "web" })
      expect(identity.platform).to eq("web")
    end

    it "accepts ios" do
      identity = parse(headers: { "X-Fintr-Platform" => "ios" })
      expect(identity.platform).to eq("ios")
    end

    it "accepts android" do
      identity = parse(headers: { "X-Fintr-Platform" => "android" })
      expect(identity.platform).to eq("android")
    end

    it "downcases the platform" do
      identity = parse(headers: { "X-Fintr-Platform" => "WEB" })
      expect(identity.platform).to eq("web")
    end

    it "returns nil for an unknown platform" do
      identity = parse(headers: { "X-Fintr-Platform" => "desktop" })
      expect(identity.platform).to be_nil
    end

    it "returns nil when the platform header is missing" do
      identity = parse
      expect(identity.platform).to be_nil
    end
  end

  describe "app_version" do
    it "returns the stripped marketing version" do
      identity = parse(
        headers: {
          "X-Fintr-Platform" => "android",
          "X-Fintr-App-Version" => " 1.27 ",
        },
      )
      expect(identity.app_version).to eq("1.27")
    end

    it "returns nil when the version header is blank" do
      identity = parse(
        headers: {
          "X-Fintr-Platform" => "ios",
          "X-Fintr-App-Version" => "  ",
        },
      )
      expect(identity.app_version).to be_nil
    end

    it "keeps an unparseable version string" do
      identity = parse(
        headers: {
          "X-Fintr-Platform" => "ios",
          "X-Fintr-App-Version" => "banana",
        },
      )
      expect(identity.app_version).to eq("banana")
    end
  end

  describe "app_build" do
    it "returns the optional build string" do
      identity = parse(
        headers: {
          "X-Fintr-Platform" => "android",
          "X-Fintr-App-Build" => "27",
        },
      )
      expect(identity.app_build).to eq("27")
    end

    it "returns nil when the build header is missing" do
      identity = parse(headers: { "X-Fintr-Platform" => "web" })
      expect(identity.app_build).to be_nil
    end
  end

  describe "native_app" do
    it "is true for ios" do
      identity = parse(headers: { "X-Fintr-Platform" => "ios" })
      expect(identity.native_app).to be(true)
    end

    it "is true for android" do
      identity = parse(headers: { "X-Fintr-Platform" => "android" })
      expect(identity.native_app).to be(true)
    end

    it "is true when User-Agent contains FintrNativeApp without version headers" do
      identity = parse(user_agent: "Mozilla/5.0 FintrNativeApp")
      expect(identity.native_app).to be(true)
    end

    it "is false for web without a native user agent" do
      identity = parse(headers: { "X-Fintr-Platform" => "web" })
      expect(identity.native_app).to be(false)
    end

    it "is false when headers and user agent are missing" do
      identity = parse
      expect(identity.native_app).to be(false)
    end
  end

  describe "helpers" do
    it "marks web? for web" do
      identity = parse(headers: { "X-Fintr-Platform" => "web" })
      expect(identity.web?).to be(true)
    end

    it "marks native? for ios" do
      identity = parse(headers: { "X-Fintr-Platform" => "ios" })
      expect(identity.native?).to be(true)
    end

    it "does not mark native? for missing platform" do
      identity = parse
      expect(identity.native?).to be(false)
    end
  end
end
```

- [ ] **Step 2: Run the spec and confirm it fails**

Run:

```bash
cd apps/fintr-be && make mspecs spec/lib/api/client_identity_parser_spec.rb
```

Expected: FAIL with `uninitialized constant Api::ClientIdentityParser` (or similar NameError).

- [ ] **Step 3: Implement identity + parser**

Create `apps/fintr-be/lib/api/client_identity.rb`:

```ruby
# frozen_string_literal: true

module Api
  ClientIdentity = Data.define(:platform, :app_version, :app_build, :native_app) do
    def web?
      platform == "web"
    end

    def native?
      platform == "ios" || platform == "android"
    end
  end
end
```

Create `apps/fintr-be/lib/api/client_identity_parser.rb`:

```ruby
# frozen_string_literal: true

module Api
  class ClientIdentityParser
    ALLOWED_PLATFORMS = %w[ios android web].freeze
    NATIVE_APP_UA_MARKER = "FintrNativeApp"

    def self.call(request:)
      new(request:).call
    end

    def initialize(request:)
      @request = request
    end

    def call
      platform = parse_platform
      Api::ClientIdentity.new(
        platform:,
        app_version: present_header("X-Fintr-App-Version"),
        app_build: present_header("X-Fintr-App-Build"),
        native_app: native?(platform:),
      )
    end

    private

    def parse_platform
      value = present_header("X-Fintr-Platform")&.downcase
      return nil unless ALLOWED_PLATFORMS.include?(value)

      value
    end

    def present_header(name)
      value = @request.headers[name].to_s.strip
      return nil if value.blank?

      value
    end

    def native?(platform:)
      platform == "ios" || platform == "android" || native_user_agent?
    end

    def native_user_agent?
      @request.user_agent.to_s.include?(NATIVE_APP_UA_MARKER)
    end
  end
end
```

Zeitwerk already autoloads `lib/` (`config.autoload_lib` in `config/application.rb`). Do not add a manual require.

- [ ] **Step 4: Run the spec and confirm it passes**

Run:

```bash
cd apps/fintr-be && make mspecs spec/lib/api/client_identity_parser_spec.rb
```

Expected: PASS (0 failures).

- [ ] **Step 5: Commit**

From the monorepo root:

```bash
git add \
  apps/fintr-be/spec/lib/api/client_identity_parser_spec.rb \
  apps/fintr-be/lib/api/client_identity.rb \
  apps/fintr-be/lib/api/client_identity_parser.rb
git commit -m "$(cat <<'EOF'
Add request client identity parsing for native vs web callers.

Store apps cannot change API clients until a binary update, so Rails needs a
stable per-request identity from headers and the existing FintrNativeApp UA.
EOF
)"
```

---

### Task 2: Version policy (web current, native cutoffs)

**Files:**
- Create: `apps/fintr-be/spec/lib/api/client_version_policy_spec.rb`
- Create: `apps/fintr-be/config/client_version_policy.yml`
- Create: `apps/fintr-be/lib/api/client_version_policy.rb`

- [ ] **Step 1: Write the failing policy spec**

Create `apps/fintr-be/spec/lib/api/client_version_policy_spec.rb`:

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe Api::ClientVersionPolicy do
  def identity(
    platform: nil,
    app_version: nil,
    app_build: nil,
    native_app: false
  )
    Api::ClientIdentity.new(
      platform:,
      app_version:,
      app_build:,
      native_app:,
    )
  end

  def classify(client, config: policy_config)
    described_class.call(client:, config:)
  end

  let(:policy_config) do
    {
      "ios" => {
        "min_supported" => "1.10",
        "offline_first_since" => "1.10",
      },
      "android" => {
        "min_supported" => "1.28",
        "offline_first_since" => "1.28",
      },
    }
  end

  describe "web" do
    let(:client) { identity(platform: "web", app_version: "ignored") }

    it "is not legacy" do
      expect(classify(client).legacy?).to be(false)
    end

    it "is offline-first" do
      expect(classify(client).offline_first?).to be(true)
    end

    it "is not unsupported" do
      expect(classify(client).unsupported?).to be(false)
    end

    it "ignores native min_supported cutoffs" do
      client = identity(platform: "web", app_version: "0.1")
      expect(classify(client).unsupported?).to be(false)
    end
  end

  describe "native at or above offline_first_since" do
    let(:client) do
      identity(
        platform: "android",
        app_version: "1.28",
        native_app: true,
      )
    end

    it "is not legacy" do
      expect(classify(client).legacy?).to be(false)
    end

    it "is offline-first" do
      expect(classify(client).offline_first?).to be(true)
    end

    it "is not unsupported" do
      expect(classify(client).unsupported?).to be(false)
    end
  end

  describe "native below offline_first_since and at or above min_supported" do
    let(:policy_config) do
      {
        "android" => {
          "min_supported" => "1.27",
          "offline_first_since" => "1.28",
        },
      }
    end

    let(:client) do
      identity(
        platform: "android",
        app_version: "1.27",
        native_app: true,
      )
    end

    it "is legacy" do
      expect(classify(client).legacy?).to be(true)
    end

    it "is not offline-first" do
      expect(classify(client).offline_first?).to be(false)
    end

    it "is not unsupported" do
      expect(classify(client).unsupported?).to be(false)
    end
  end

  describe "native below min_supported" do
    let(:client) do
      identity(
        platform: "ios",
        app_version: "1.9",
        native_app: true,
      )
    end

    it "is legacy" do
      expect(classify(client).legacy?).to be(true)
    end

    it "is not offline-first" do
      expect(classify(client).offline_first?).to be(false)
    end

    it "is unsupported" do
      expect(classify(client).unsupported?).to be(true)
    end
  end

  describe "null cutoffs" do
    let(:policy_config) do
      {
        "ios" => {
          "min_supported" => nil,
          "offline_first_since" => nil,
        },
        "android" => {
          "min_supported" => nil,
          "offline_first_since" => nil,
        },
      }
    end

    let(:client) do
      identity(
        platform: "android",
        app_version: "1.27",
        native_app: true,
      )
    end

    it "classifies native as legacy" do
      expect(classify(client).legacy?).to be(true)
    end

    it "does not classify native as offline-first" do
      expect(classify(client).offline_first?).to be(false)
    end

    it "does not classify native as unsupported" do
      expect(classify(client).unsupported?).to be(false)
    end
  end

  describe "missing or unparseable identity" do
    it "classifies missing headers as legacy" do
      expect(classify(identity).legacy?).to be(true)
    end

    it "does not mark missing headers unsupported" do
      expect(classify(identity).unsupported?).to be(false)
    end

    it "classifies banana versions as legacy" do
      client = identity(platform: "ios", app_version: "banana", native_app: true)
      expect(classify(client).legacy?).to be(true)
    end

    it "does not mark banana versions unsupported" do
      client = identity(platform: "ios", app_version: "banana", native_app: true)
      expect(classify(client).unsupported?).to be(false)
    end

    it "classifies FintrNativeApp without a version as legacy" do
      client = identity(native_app: true)
      expect(classify(client).legacy?).to be(true)
    end
  end

  describe ".discovery_payload" do
    it "returns yaml cutoffs and static capabilities" do
      payload = described_class.discovery_payload(config: policy_config)
      expect(payload).to eq(
        min_supported: { ios: "1.10", android: "1.28" },
        offline_first_since: { ios: "1.10", android: "1.28" },
        capabilities: ["live-get", "sync-bootstrap"],
      )
    end

    it "returns nil cutoffs when the yaml values are blank" do
      payload = described_class.discovery_payload(
        config: {
          "ios" => { "min_supported" => nil, "offline_first_since" => nil },
          "android" => { "min_supported" => nil, "offline_first_since" => nil },
        },
      )
      expect(payload[:min_supported]).to eq(ios: nil, android: nil)
    end
  end
end
```

- [ ] **Step 2: Run the spec and confirm it fails**

Run:

```bash
cd apps/fintr-be && make mspecs spec/lib/api/client_version_policy_spec.rb
```

Expected: FAIL with `uninitialized constant Api::ClientVersionPolicy`.

- [ ] **Step 3: Add YAML + policy class**

Create `apps/fintr-be/config/client_version_policy.yml`:

```yaml
shared:
  ios:
    min_supported: null
    offline_first_since: null
  android:
    min_supported: null
    offline_first_since: null

development: {}
test: {}
production: {}
staging: {}
```

Leave both cutoffs `null` until the first offline-first store build ships. Do not copy iOS `1.9` / Android `1.27` into `min_supported` — that would mark current store apps unsupported in the policy object even though this slice does not return 426.

Create `apps/fintr-be/lib/api/client_version_policy.rb`:

```ruby
# frozen_string_literal: true

module Api
  class ClientVersionPolicy
    CAPABILITIES = [
      "live-get",
      "sync-bootstrap",
    ].freeze

    Classification = Data.define(:legacy, :offline_first, :unsupported) do
      def legacy?
        legacy
      end

      def offline_first?
        offline_first
      end

      def unsupported?
        unsupported
      end
    end

    def self.call(client:, config: nil)
      new(config: config || load_config).classify(client:)
    end

    def self.discovery_payload(config: nil)
      new(config: config || load_config).discovery_payload
    end

    def self.load_config
      Rails.application.config_for(:client_version_policy)
        .to_h
        .with_indifferent_access
    end

    def initialize(config:)
      @config = config.to_h.with_indifferent_access
    end

    def classify(client:)
      return current if client.web?

      version = parse_version(client.app_version)
      platform_config = @config[client.platform] || {}

      if below_cutoff?(version:, cutoff: platform_config[:min_supported])
        return Classification.new(
          legacy: true,
          offline_first: false,
          unsupported: true,
        )
      end

      if at_or_above_cutoff?(
           version:,
           cutoff: platform_config[:offline_first_since],
         )
        return current
      end

      Classification.new(
        legacy: true,
        offline_first: false,
        unsupported: false,
      )
    end

    def discovery_payload
      {
        min_supported: {
          ios: blank_to_nil(@config.dig(:ios, :min_supported)),
          android: blank_to_nil(@config.dig(:android, :min_supported)),
        },
        offline_first_since: {
          ios: blank_to_nil(@config.dig(:ios, :offline_first_since)),
          android: blank_to_nil(@config.dig(:android, :offline_first_since)),
        },
        capabilities: CAPABILITIES,
      }
    end

    private

    def current
      Classification.new(
        legacy: false,
        offline_first: true,
        unsupported: false,
      )
    end

    def parse_version(value)
      return nil if value.blank?
      return nil unless Gem::Version.correct?(value.to_s)

      Gem::Version.new(value.to_s)
    end

    def parse_cutoff(value)
      parse_version(blank_to_nil(value))
    end

    def below_cutoff?(version:, cutoff:)
      parsed_cutoff = parse_cutoff(cutoff)
      return false if version.nil? || parsed_cutoff.nil?

      version < parsed_cutoff
    end

    def at_or_above_cutoff?(version:, cutoff:)
      parsed_cutoff = parse_cutoff(cutoff)
      return false if version.nil? || parsed_cutoff.nil?

      version >= parsed_cutoff
    end

    def blank_to_nil(value)
      return nil if value.blank?

      value
    end
  end
end
```

- [ ] **Step 4: Run the spec and confirm it passes**

Run:

```bash
cd apps/fintr-be && make mspecs spec/lib/api/client_version_policy_spec.rb
```

Expected: PASS (0 failures).

If `config_for` raises because YAML env keys are empty, keep `shared:` and give each env the same ios/android null hashes explicitly.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/fintr-be/spec/lib/api/client_version_policy_spec.rb \
  apps/fintr-be/config/client_version_policy.yml \
  apps/fintr-be/lib/api/client_version_policy.rb
git commit -m "$(cat <<'EOF'
Add per-platform client version policy for offline-first vs legacy.

iOS and Android marketing versions are not aligned, and web has no store
number, so classification must be config-driven and never compare browsers
to App Store cutoffs.
EOF
)"
```

---

### Task 3: Assign identity on every request + CORS

**Files:**
- Create: `apps/fintr-be/spec/controllers/concerns/assign_client_identity_spec.rb`
- Create: `apps/fintr-be/spec/requests/api/v1/client_identity_spec.rb`
- Create: `apps/fintr-be/app/controllers/concerns/assign_client_identity.rb`
- Modify: `apps/fintr-be/app/models/current.rb`
- Modify: `apps/fintr-be/app/controllers/application_controller.rb`
- Modify: `apps/fintr-be/config/initializers/cors.rb`

- [ ] **Step 1: Write the failing wiring specs**

Create `apps/fintr-be/spec/controllers/concerns/assign_client_identity_spec.rb`:

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe AssignClientIdentity do
  it "runs assign_client_identity before authorize" do
    filters = ApplicationController._process_action_callbacks
      .select { |callback| callback.kind == :before }
      .map(&:filter)

    expect(filters.index(:assign_client_identity)).to be < filters.index(:authorize)
  end
end
```

Create `apps/fintr-be/spec/requests/api/v1/client_identity_spec.rb`:

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "client identity headers", type: :request do
  describe "GET /api/v1/insights without auth" do
    it "does not return 400 for junk client headers" do
      get "/api/v1/insights",
          headers: {
            "Accept" => "application/json",
            "X-Fintr-Platform" => "desktop",
            "X-Fintr-App-Version" => "banana",
          }

      expect(response).not_to have_http_status(:bad_request)
    end

    it "still returns unauthorized" do
      get "/api/v1/insights",
          headers: {
            "Accept" => "application/json",
            "X-Fintr-Platform" => "desktop",
            "X-Fintr-App-Version" => "banana",
          }

      expect(response).to have_http_status(:unauthorized)
    end
  end
end
```

- [ ] **Step 2: Run the specs and confirm they fail**

Run:

```bash
cd apps/fintr-be && make mspecs spec/controllers/concerns/assign_client_identity_spec.rb spec/requests/api/v1/client_identity_spec.rb
```

Expected: FAIL — `uninitialized constant AssignClientIdentity` and/or `filters.index(:assign_client_identity)` is `nil`. The insights examples may already 401 today; the concern spec is the one that must fail first.

- [ ] **Step 3: Wire Current, concern, ApplicationController, CORS**

Replace `apps/fintr-be/app/models/current.rb` with:

```ruby
# frozen_string_literal: true

class Current < ActiveSupport::CurrentAttributes
  attribute :client_tab_id
  attribute :client
end
```

Create `apps/fintr-be/app/controllers/concerns/assign_client_identity.rb`:

```ruby
# frozen_string_literal: true

module AssignClientIdentity
  extend ActiveSupport::Concern

  included do
    prepend_before_action :assign_client_identity
  end

  private

  def assign_client_identity
    Current.client = Api::ClientIdentityParser.call(request:)
  end
end
```

Modify `apps/fintr-be/app/controllers/application_controller.rb` to include the concern **after** `Secured` so `prepend_before_action` still runs first:

```ruby
# frozen_string_literal: true

class ApplicationController < ActionController::API
  # Make sure ApiResponses is included if not done elsewhere
  include ApiResponses
  # Include the new pagination helper concern
  include PaginatedResponses
  include RecordResponses
  # Include Secured concern for authentication
  include Secured
  include AssignClientIdentity

  before_action :authorize
end
```

In `apps/fintr-be/config/initializers/cors.rb`, add the three headers to the existing `headers:` array (keep vertical list, do not expose them):

```ruby
      headers: %w[
        Authorization
        X-Space-Code
        X-Client-Tab-Id
        X-Fintr-Platform
        X-Fintr-App-Version
        X-Fintr-App-Build
        X-Requested-With
        Content-Type
        Accept
        Cache-Control
        Connection
        Pragma
        Expires
        X-Accel-Buffering
      ],
```

- [ ] **Step 4: Run the specs and confirm they pass**

Run:

```bash
cd apps/fintr-be && make mspecs spec/controllers/concerns/assign_client_identity_spec.rb spec/requests/api/v1/client_identity_spec.rb
```

Expected: PASS (0 failures).

- [ ] **Step 5: Commit**

```bash
git add \
  apps/fintr-be/spec/controllers/concerns/assign_client_identity_spec.rb \
  apps/fintr-be/spec/requests/api/v1/client_identity_spec.rb \
  apps/fintr-be/app/controllers/concerns/assign_client_identity.rb \
  apps/fintr-be/app/models/current.rb \
  apps/fintr-be/app/controllers/application_controller.rb \
  apps/fintr-be/config/initializers/cors.rb
git commit -m "$(cat <<'EOF'
Assign API client identity before authorization on every request.

Legacy store apps will omit the new headers; parsing must never 400 or skip
identity when authorize later returns 401.
EOF
)"
```

---

### Task 4: Advertise policy on GET /cache_version

**Files:**
- Create: `apps/fintr-be/spec/requests/api/v1/cache_version_spec.rb`
- Modify: `apps/fintr-be/app/controllers/api/v1/cache_version_controller.rb`

- [ ] **Step 1: Write the failing request spec**

Create `apps/fintr-be/spec/requests/api/v1/cache_version_spec.rb`:

```ruby
# frozen_string_literal: true

require "rails_helper"

RSpec.describe "GET /api/v1/cache_version", type: :request do
  def parsed_data
    JSON.parse(response.body).fetch("data")
  end

  it "returns ok without authentication" do
    get "/api/v1/cache_version"
    expect(response).to have_http_status(:ok)
  end

  it "returns cacheVersion" do
    get "/api/v1/cache_version"
    expect(parsed_data).to have_key("cacheVersion")
  end

  it "returns api.minSupported for both platforms" do
    get "/api/v1/cache_version"
    expect(parsed_data.dig("api", "minSupported").keys).to contain_exactly("ios", "android")
  end

  it "returns api.offlineFirstSince for both platforms" do
    get "/api/v1/cache_version"
    expect(parsed_data.dig("api", "offlineFirstSince").keys).to contain_exactly("ios", "android")
  end

  it "returns static api capabilities" do
    get "/api/v1/cache_version"
    expect(parsed_data.dig("api", "capabilities")).to eq(
      [
        "live-get",
        "sync-bootstrap",
      ],
    )
  end

  it "returns the same api discovery object when client headers are junk" do
    get "/api/v1/cache_version",
        headers: {
          "X-Fintr-Platform" => "desktop",
          "X-Fintr-App-Version" => "banana",
        }

    expect(parsed_data.dig("api", "capabilities")).to eq(
      [
        "live-get",
        "sync-bootstrap",
      ],
    )
  end

  it "returns ok when client headers are junk" do
    get "/api/v1/cache_version",
        headers: {
          "X-Fintr-Platform" => "desktop",
          "X-Fintr-App-Version" => "banana",
        }

    expect(response).to have_http_status(:ok)
  end
end
```

Do not add `api` fields to admin cache specs or controllers.

- [ ] **Step 2: Run the spec and confirm it fails**

Run:

```bash
cd apps/fintr-be && make mspecs spec/requests/api/v1/cache_version_spec.rb
```

Expected: FAIL — `data["api"]` is `nil` (examples that check `cacheVersion` / 200 may already pass).

- [ ] **Step 3: Merge discovery into the public cache version payload**

Replace `apps/fintr-be/app/controllers/api/v1/cache_version_controller.rb` with:

```ruby
# frozen_string_literal: true

module Api
  module V1
    # Public endpoint for mobile apps to check current cache version (no auth).
    # Used so iOS/Android can clear local cache and reload when admin bumps version.
    # Also advertises API client-version cutoffs (additive; old apps ignore unknown fields).
    class CacheVersionController < ApplicationController
      skip_before_action :authorize

      # GET /api/v1/cache_version
      def show
        cache_version = Rails.cache.fetch("capacitor_cache_version") do
          Time.zone.now.to_i.to_s
        end

        render_success(
          data: {
            cache_version: cache_version,
            updated_at: Rails.cache.read("capacitor_cache_version_updated_at"),
            api: ::Api::ClientVersionPolicy.discovery_payload,
          },
        )
      end
    end
  end
end
```

Use `::Api::ClientVersionPolicy` so Rails does not look up `Api::V1::Api::ClientVersionPolicy`.

- [ ] **Step 4: Run the spec and confirm it passes**

Run:

```bash
cd apps/fintr-be && make mspecs spec/requests/api/v1/cache_version_spec.rb
```

Expected: PASS (0 failures). With default YAML, `minSupported.ios` and `offlineFirstSince.*` are JSON `null`.

- [ ] **Step 5: Commit**

```bash
git add \
  apps/fintr-be/spec/requests/api/v1/cache_version_spec.rb \
  apps/fintr-be/app/controllers/api/v1/cache_version_controller.rb
git commit -m "$(cat <<'EOF'
Advertise API client-version cutoffs on the public cache_version endpoint.

Old store apps already call this URL for WebView cache busting and ignore
unknown JSON fields, so it is the discovery surface for min version and
offline-first since without a second unauthenticated round trip.
EOF
)"
```

---

### Task 5: Document identity headers

**Files:**
- Modify: `docs/API_REQUEST_PARAMETERS.md`
- Modify: `docs/superpowers/specs/2026-08-27-api-client-versioning-design.md` (status line only)

- [ ] **Step 1: Append the headers section to the API params doc**

Add this to the end of `docs/API_REQUEST_PARAMETERS.md` (do not change the snake_case body-param rules):

```markdown
## Client identity headers (not body params)

Native and web clients identify themselves with request **headers**, not JSON keys. `SnakeCaseParameters` does not rewrite these. Do not `permit` them on controllers.

| Header | Values | Purpose |
|--------|--------|---------|
| `X-Fintr-Platform` | `ios` \| `android` \| `web` | Platform for version policy |
| `X-Fintr-App-Version` | Marketing version, e.g. `1.27` | Native store version; optional log id on web |
| `X-Fintr-App-Build` | Native build number | Logs only |

Missing or invalid headers are treated as **legacy**. They must not produce 400. Cutoffs live in `apps/fintr-be/config/client_version_policy.yml` and are advertised on `GET /api/v1/cache_version` under `data.api`. See `docs/superpowers/specs/2026-08-27-api-client-versioning-design.md`.
```

- [ ] **Step 2: Mark the design spec implemented for this slice**

In `docs/superpowers/specs/2026-08-27-api-client-versioning-design.md`, change:

```markdown
**Status:** design (backend slice). Not implemented.
```

to:

```markdown
**Status:** implemented (backend slice: identity + policy + `cache_version` discovery). No live-GET fork, no 426, no `/api/v2`.
```

- [ ] **Step 3: Refresh graphify doc nodes**

From the monorepo root:

```bash
set -a && source apps/fintr-be/.env && set +a && graphify extract . --backend openai
```

Expected: extract completes; `graphify-out/` updates. Stage those files in the same commit.

- [ ] **Step 4: Commit**

```bash
git add \
  docs/API_REQUEST_PARAMETERS.md \
  docs/superpowers/specs/2026-08-27-api-client-versioning-design.md \
  graphify-out/
git commit -m "$(cat <<'EOF'
Document API client identity headers next to request parameter rules.

Callers send platform and app version on headers, not in JSON bodies, and
operators need one place that says not to permit those keys on controllers.
EOF
)"
```

---

### Task 6: RuboCop and changed specs

**Files:** all files from Tasks 1–5

- [ ] **Step 1: Auto-correct Ruby**

Run:

```bash
cd apps/fintr-be && make mrubocop \
  lib/api/client_identity.rb \
  lib/api/client_identity_parser.rb \
  lib/api/client_version_policy.rb \
  app/controllers/concerns/assign_client_identity.rb \
  app/models/current.rb \
  app/controllers/application_controller.rb \
  app/controllers/api/v1/cache_version_controller.rb \
  spec/lib/api/client_identity_parser_spec.rb \
  spec/lib/api/client_version_policy_spec.rb \
  spec/controllers/concerns/assign_client_identity_spec.rb \
  spec/requests/api/v1/client_identity_spec.rb \
  spec/requests/api/v1/cache_version_spec.rb
```

Expected: RuboCop exits 0. If it rewrites files, keep the behavior identical.

- [ ] **Step 2: Run specs for every touched Ruby file**

Run:

```bash
cd apps/fintr-be && make mchanged-specs
```

Expected: 0 failures.

Also run the three spec groups from the design doc:

```bash
cd apps/fintr-be && make mspecs \
  spec/lib/api/client_identity_parser_spec.rb \
  spec/lib/api/client_version_policy_spec.rb \
  spec/requests/api/v1/cache_version_spec.rb
```

Expected: 0 failures.

- [ ] **Step 3: Commit RuboCop-only diffs if any**

If `git status` shows formatting changes:

```bash
git add apps/fintr-be
git commit -m "$(cat <<'EOF'
Fix RuboCop on API client versioning files.

Keep the new identity and cache_version discovery path consistent with the
backend style guide after the feature specs landed.
EOF
)"
```

If there are no changes, do not create an empty commit.

---

## Out of scope (do not do in this plan)

- Frontend axios interceptor (`App.getInfo()`, `X-Fintr-Platform: web`)
- HTTP 426 / force-update UI
- Changing `GET /dashboard`, `/insights`, `/transactions` JSON
- `/api/v2`
- Setting `offline_first_since` to a real store version (wait until that binary ships)

---

## Self-review

| Spec requirement | Task |
|------------------|------|
| Headers + parser rules | Task 1 |
| `ClientIdentity` `web?` / `native?` | Task 1 |
| YAML policy, web always current, per-platform cutoffs | Task 2 |
| `unsupported?` computed, no 426 | Task 2 + Task 4 |
| `AssignClientIdentity` prepended before authorize | Task 3 |
| `Current.client` | Task 3 |
| CORS allow list | Task 3 |
| Additive `cache_version` `api` object | Task 4 |
| Junk headers never 400 | Task 3 + Task 4 |
| `API_REQUEST_PARAMETERS.md` | Task 5 |
| No live-GET fork, no `/api/v2` | All tasks omit those files |
