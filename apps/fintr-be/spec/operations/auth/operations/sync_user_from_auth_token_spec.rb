# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::Operations::SyncUserFromAuthToken do
  let(:operation) { described_class.new }

  let(:user) { create(:user, auth_id: "auth0|1", email: "keep@example.com", full_name: "Old Name", photo_url: nil) }

  let(:params) do
    {
      user:,
      auth_id: user.auth_id,
      email: user.email,
      full_name: "New Name",
      photo_url: "https://example.com/p.jpg"
    }
  end

  describe "#call" do
    subject(:call_operation) { operation.call(params) }

    it { is_expected.to be_success }

    it "updates profile fields from the token" do
      call_operation
      user.reload
      expect(user.full_name).to eq("New Name")
      expect(user.photo_url).to eq("https://example.com/p.jpg")
    end

    context "when token fields match the database" do
      let(:params) do
        {
          user:,
          auth_id: user.auth_id,
          email: user.email,
          full_name: user.full_name
        }
      end

      it { is_expected.to be_success }

      it "does not touch the database when nothing changed" do
        expect { call_operation }.not_to change { user.reload.updated_at }
      end
    end

    context "when photo_url is blank in the token" do
      let(:user) do
        create(
          :user,
          auth_id: "auth0|1",
          email: "keep@example.com",
          full_name: "Old Name",
          photo_url: "https://example.com/existing.jpg",
        )
      end
      let(:params) do
        {
          user:,
          auth_id: user.auth_id,
          email: user.email,
          full_name: user.full_name,
          photo_url: nil,
        }
      end

      it "does not clear the existing photo_url" do
        call_operation

        expect(user.reload.photo_url).to eq("https://example.com/existing.jpg")
      end
    end

    context "when validation fails" do
      let(:params) do
        {
          user:,
          auth_id: user.auth_id,
          email: "not-an-email",
          full_name: user.full_name
        }
      end

      it { is_expected.to be_failure }
    end
  end
end
