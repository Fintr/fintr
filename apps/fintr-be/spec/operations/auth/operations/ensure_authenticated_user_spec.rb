# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::Operations::EnsureAuthenticatedUser do
  let(:operation) { described_class.new }

  let(:token_params) do
    {
      auth_id: "auth0|token-user",
      email: "token@example.com",
      full_name: "Token User"
    }
  end

  describe "#call" do
    subject(:call_operation) { operation.call(token_params) }

    context "when no user exists for the token" do
      let(:provision) { instance_double(Auth::Operations::CreateUserAndSpace) }
      let(:created_user) { create(:user, auth_id: token_params[:auth_id], email: token_params[:email]) }

      before do
        allow(Auth::Operations::CreateUserAndSpace).to receive(:new).and_return(provision)
        allow(provision).to receive(:call).and_return(Dry::Monads::Result::Success.new(created_user))
      end

      it { is_expected.to be_success }

      it "runs full provisioning" do
        expect(provision).to receive(:call).with(hash_including(token_params))

        call_operation
      end
    end

    context "when user is matched by auth_id and already has a personal space" do
      let!(:user) { create(:user, auth_id: token_params[:auth_id], email: token_params[:email], full_name: "Old") }
      let!(:space) { create(:personal_space, users: [user]) }
      let(:provision_double) { instance_double(Auth::Operations::CreateUserAndSpace) }
      let(:sync_double) { instance_double(Auth::Operations::SyncUserFromAuthToken) }

      before do
        allow(Auth::Operations::CreateUserAndSpace).to receive(:new).and_return(provision_double)
        allow(provision_double).to receive(:call)

        allow(Auth::Operations::SyncUserFromAuthToken).to receive(:new).and_return(sync_double)
        allow(sync_double).to receive(:call).and_return(Dry::Monads::Result::Success.new(user))
      end

      it { is_expected.to be_success }

      it "syncs profile from the token without running CreateUserAndSpace" do
        expect(provision_double).not_to receive(:call)
        expect(sync_double).to receive(:call).with(hash_including(user:, auth_id: token_params[:auth_id]))

        call_operation
      end
    end

    context "when user is matched by auth_id but has no personal space yet" do
      let!(:user) { create(:user, auth_id: token_params[:auth_id], email: token_params[:email]) }
      let(:provision) { instance_double(Auth::Operations::CreateUserAndSpace) }

      before do
        allow(Auth::Operations::CreateUserAndSpace).to receive(:new).and_return(provision)
        allow(provision).to receive(:call).and_return(Dry::Monads::Result::Success.new(user))
      end

      it "runs provisioning to create space and roles" do
        expect(provision).to receive(:call).with(hash_including(token_params))

        expect(call_operation).to be_success
      end
    end

    context "when user is matched by email only and already has a personal space" do
      let!(:user) { create(:user, email: token_params[:email], auth_id: "other-provider|9") }
      let!(:space) { create(:personal_space, users: [user]) }
      let(:provision_double) { instance_double(Auth::Operations::CreateUserAndSpace) }

      before do
        allow(Auth::Operations::CreateUserAndSpace).to receive(:new).and_return(provision_double)
        allow(provision_double).to receive(:call)
      end

      it { is_expected.to be_success }

      it "returns the user without provisioning or syncing auth_id" do
        expect(provision_double).not_to receive(:call)

        result = call_operation
        expect(result.value!).to eq(user)
        user.reload
        expect(user.auth_id).to eq("other-provider|9")
      end
    end

    context "when user is matched by email only and has no personal space" do
      let!(:user) { create(:user, email: token_params[:email], auth_id: "other-provider|9") }
      let(:provision) { instance_double(Auth::Operations::CreateUserAndSpace) }

      before do
        allow(Auth::Operations::CreateUserAndSpace).to receive(:new).and_return(provision)
        allow(provision).to receive(:call).and_return(Dry::Monads::Result::Success.new(user))
      end

      it "runs provisioning for space setup" do
        expect(provision).to receive(:call).with(hash_including(token_params))

        expect(call_operation).to be_success
      end
    end
  end
end
