# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::Attachments", type: :request do
  let!(:user) { create(:user) }
  let!(:space) { create(:personal_space, users: [user]) }
  let!(:auth) { setup_authentication(user:, space:) }
  let(:headers) { auth[:headers] }
  let(:object_key) { "spaces/#{space.id}/receipt.jpg" }
  let(:download_url) do
    "https://storage.googleapis.com/fintr-dev/#{object_key}"
  end

  describe "GET /api/v1/attachments/download" do
    context "when the object exists in Active Storage" do
      before do
        ActiveStorage::Blob.create_and_upload!(
          io: StringIO.new("receipt-bytes"),
          filename: "receipt.jpg",
          content_type: "image/jpeg",
          key: object_key
        )

        get "/api/v1/attachments/download",
            params: { url: download_url },
            headers:
      end

      it "returns success" do
        expect(response).to have_http_status(:ok)
      end

      it "returns the stored file bytes" do
        expect(response.body).to eq("receipt-bytes")
      end
    end

    context "when the object is missing" do
      before do
        get "/api/v1/attachments/download",
            params: { url: download_url },
            headers:
      end

      it "returns not found" do
        expect(response).to have_http_status(:not_found)
      end
    end

    context "when the url is not an allowed Fintr storage prefix" do
      before do
        get "/api/v1/attachments/download",
            params: { url: "https://evil.example/secret.jpg" },
            headers:
      end

      it "returns forbidden" do
        expect(response).to have_http_status(:forbidden)
      end
    end

    context "when the file belongs to another space" do
      let!(:other_space) { create(:personal_space) }
      let(:other_key) { "spaces/#{other_space.id}/receipt.jpg" }

      before do
        ActiveStorage::Blob.create_and_upload!(
          io: StringIO.new("other-receipt"),
          filename: "receipt.jpg",
          content_type: "image/jpeg",
          key: other_key
        )

        get "/api/v1/attachments/download",
            params: {
              url: "https://storage.googleapis.com/fintr-dev/#{other_key}"
            },
            headers:
      end

      it "returns forbidden" do
        expect(response).to have_http_status(:forbidden)
      end

      it "does not return the other space file" do
        expect(response.body).not_to eq("other-receipt")
      end
    end

    context "when the request is not signed in" do
      before do
        get "/api/v1/attachments/download",
            params: { url: download_url }
      end

      it "returns unauthorized" do
        expect(response).to have_http_status(:unauthorized)
      end
    end
  end
end
