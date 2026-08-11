# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Spaces::Sync", type: :request do
  let(:user) { create(:user) }
  let(:space) { create(:personal_space) }
  let!(:space_user) { create(:space_user, user:, space:) }
  let(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }

  def seed_retained_change_log!
    Sync::SpaceSequence.create!(space_id: space.id, last_seq: 5002)

    [
      { seq: 5000, description: "Retained peer change day 91" },
      { seq: 5001, description: "Retained peer change day 95" },
      { seq: 5002, description: "Retained peer change day 100" },
    ].each do |row|
      Sync::ChangeLogEntry.create!(
        space_id: space.id,
        seq: row[:seq],
        op: "transaction.created",
        payload: {
          transactions: [
            {
              id: SecureRandom.uuid,
              description: row[:description],
              type: "expense",
              amount: 10,
              date: Date.current.to_s,
              category_name: "Food",
              from_account_name: "Cash",
              to_account_name: "",
              in_series: false,
              has_image: false,
            },
          ],
        },
      )
    end
  end

  describe "GET /api/v1/spaces/sync/changes" do
    context "when client was offline 100 days (cursor before retained log)" do
      before { seed_retained_change_log! }

      it "returns 410 Gone with bootstrapRequired" do
        get "/api/v1/spaces/sync/changes",
            params: { since: 1000 },
            headers: headers

        expect(response).to have_http_status(:gone)

        body = JSON.parse(response.body)
        expect(body["success"]).to be(false)
        expect(body["error"]["details"]["bootstrapRequired"]).to be(true)
        expect(body["error"]["details"]["oldestAvailableSeq"]).to eq(5000)
      end

      it "does not include expired day 1–10 log rows in the response" do
        get "/api/v1/spaces/sync/changes",
            params: { since: 1000 },
            headers: headers

        body = JSON.parse(response.body)
        expect(body["data"]).to be_nil
      end
    end

    context "after bootstrap-equivalent pull from oldestAvailableSeq" do
      before { seed_retained_change_log! }

      it "returns retained changes when since matches oldest available seq" do
        get "/api/v1/spaces/sync/changes",
            params: { since: 5000 },
            headers: headers

        expect(response).to have_http_status(:ok)

        body = JSON.parse(response.body)
        changes = body["data"]["changes"]
        expect(changes.map { |change| change["seq"] }).to eq([5001, 5002])
      end

      it "returns full retained window when since is 0" do
        get "/api/v1/spaces/sync/changes",
            params: { since: 0 },
            headers: headers

        expect(response).to have_http_status(:ok)

        body = JSON.parse(response.body)
        changes = body["data"]["changes"]
        expect(changes.map { |change| change["seq"] }).to eq([5000, 5001, 5002])
      end
    end
  end

  describe "GET /api/v1/spaces/sync/bootstrap" do
    let(:account) { create(:account, space:) }
    let(:category) { create(:category, space:, category_type: "expense", name: "Food") }

    before do
      create(
        :expense_transaction,
        space:,
        account:,
        category:,
        user:,
        amount: Money.from_amount(40, "PHP"),
        date: Date.current,
        description: "Bootstrap meal",
      )
      Sync::SpaceSequence.create!(space_id: space.id, last_seq: 99)
    end

    it "returns a bulk bootstrap snapshot with latestSeq and totals" do
      get "/api/v1/spaces/sync/bootstrap", headers: headers

      expect(response).to have_http_status(:ok)

      body = JSON.parse(response.body)
      data = body["data"]

      expect(data["latestSeq"]).to eq(99)
      expect(data["totals"]["transactions"]).to be >= 1
      expect(data["totals"]["truncated"]).to be(false)
      expect(data["transactions"]).to be_an(Array)
      expect(data["accounts"]).to be_present
      expect(data["categories"]).to be_present
      expect(data["space"]).to include("id" => space.id)
    end
  end
end
