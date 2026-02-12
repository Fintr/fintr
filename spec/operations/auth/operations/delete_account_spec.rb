# frozen_string_literal: true

require "rails_helper"

RSpec.describe Auth::Operations::DeleteAccount do
  let(:operation) { described_class.new }
  let!(:user) { create(:user, auth_id: "auth0|test123") }
  let!(:personal_space) { create(:personal_space, users: [user]) }
  let(:auth0_client) { instance_double("Auth0Client", delete_user: nil) }

  before do
    user.add_role(:admin, personal_space)
    allow(Auth::M2mClient).to receive(:client).and_return(auth0_client)
    allow(Auth::M2mClient).to receive(:reset!)
    allow(Sentry).to receive(:capture_exception)
  end

  describe "#call" do
    subject(:call_operation) { operation.call(user_id: user.id) }

    context "when the operation is successful" do
      it { is_expected.to be_success }

      it "returns success message" do
        expect(call_operation.value!).to eq(message: "Account deleted successfully")
      end

      it "deletes the user" do
        call_operation
        expect(Auth::User.exists?(user.id)).to be false
      end

      it "deletes the personal space" do
        call_operation
        expect(Spaces::Space.exists?(personal_space.id)).to be false
      end

      it "calls Auth0 to delete the user" do
        call_operation
        expect(auth0_client).to have_received(:delete_user).with(user.auth_id)
      end
    end

    context "when validation fails" do
      context "when user_id is empty" do
        subject(:call_operation) { operation.call(user_id: "") }

        it { is_expected.to be_failure }

        it "returns validation errors" do
          expect(call_operation.failure).to have_key(:user_id)
        end
      end
    end

    context "when find_user step fails" do
      subject(:call_operation) { operation.call(user_id: SecureRandom.uuid) }

      it { is_expected.to be_failure }

      it "returns user not found error" do
        expect(call_operation.failure).to eq(user: ["not found"])
      end
    end

    context "when delete_user_spaces step fails" do
      before do
        allow(operation).to receive(:find_user).and_return(Dry::Monads::Result::Success.new(user))
        allow(operation).to receive(:delete_user_spaces).and_return(
          Dry::Monads::Result::Failure.new(error: "Failed to delete user spaces: some error")
        )
      end

      it { is_expected.to be_failure }

      it "returns the failure from delete_user_spaces" do
        expect(call_operation.failure).to eq(error: "Failed to delete user spaces: some error")
      end
    end
  end

  describe "#delete_user_spaces" do
    subject(:delete_user_spaces_result) { operation.send(:delete_user_spaces, user:) }

    it { is_expected.to be_success }

    it "calls ResetData to clear space data" do
      reset_data_operation = instance_double(Spaces::Operations::ResetData)
      allow(Spaces::Operations::ResetData).to receive(:new).and_return(reset_data_operation)
      allow(reset_data_operation).to receive(:call).and_return(Dry::Monads::Success({}))

      delete_user_spaces_result
      expect(reset_data_operation).to have_received(:call).with(space_id: personal_space.id, user_id: user.id)
    end

    it "deletes the personal space" do
      delete_user_spaces_result
      expect(Spaces::Space.exists?(personal_space.id)).to be false
    end

    context "when user belongs to an organization space" do
      let!(:org_space) { create(:organization_space) }
      let!(:org_space_user) { create(:space_user, user: user, space: org_space) }

      it { is_expected.to be_success }

      it "removes user from the organization space" do
        delete_user_spaces_result
        expect(Spaces::SpaceUser.exists?(user_id: user.id, space_id: org_space.id)).to be false
      end

      it "does not delete the organization space itself" do
        delete_user_spaces_result
        expect(Spaces::Space.exists?(org_space.id)).to be true
      end
    end
  end

  describe "#delete_space_completely" do
    subject(:delete_space_result) { operation.send(:delete_space_completely, space_id: personal_space.id, user: user) }

    it "calls ResetData to clear the bulk of space data" do
      reset_data_operation = instance_double(Spaces::Operations::ResetData)
      allow(Spaces::Operations::ResetData).to receive(:new).and_return(reset_data_operation)
      allow(reset_data_operation).to receive(:call).and_return(Dry::Monads::Success({}))

      delete_space_result
      expect(reset_data_operation).to have_received(:call).with(space_id: personal_space.id, user_id: user.id)
    end

    it "deletes the space" do
      delete_space_result
      expect(Spaces::Space.exists?(personal_space.id)).to be false
    end

    context "when space has CRM tickets" do
      let!(:ticket) { create(:crm_ticket, user: user, space: personal_space) }
      let!(:ticket_response) { create(:crm_ticket_response, ticket: ticket) }

      it "deletes CRM tickets and responses" do
        expect { delete_space_result }.to change(Crm::Ticket, :count).by(-1)
          .and change(Crm::TicketResponse, :count).by(-1)
      end
    end

    context "when space has AI data" do
      let!(:ai_interaction) { create(:ai_interaction, user: user, space: personal_space) }
      let!(:ai_usage) { create(:ai_usage, user: user, space: personal_space) }

      it "deletes AI interactions" do
        expect { delete_space_result }.to change(Ai::Interaction, :count).by(-1)
      end

      it "deletes AI usages" do
        expect { delete_space_result }.to change(Ai::Usage, :count).by(-1)
      end
    end

    context "when space has entities" do
      let!(:entity) { create(:entity, space: personal_space) }

      it "deletes entities" do
        expect { delete_space_result }.to change(Entities::Entity, :count).by(-1)
      end
    end

    context "when space has monthly financial summaries" do
      let!(:summary) { create(:monthly_financial_summary, space: personal_space) }

      it "deletes monthly financial summaries" do
        expect { delete_space_result }.to change(MonthlyFinancialSummary, :count).by(-1)
      end
    end

    context "when space does not exist" do
      subject(:delete_space_result) { operation.send(:delete_space_completely, space_id: SecureRandom.uuid, user: user) }

      it "returns nil without error" do
        expect(delete_space_result).to be_nil
      end
    end
  end

  describe "#delete_user_from_auth0" do
    subject(:delete_auth0_result) { operation.send(:delete_user_from_auth0, user:) }

    context "when Auth0 deletion succeeds" do
      it { is_expected.to be_success }

      it "calls Auth0 to delete the user" do
        delete_auth0_result
        expect(auth0_client).to have_received(:delete_user).with(user.auth_id)
      end
    end

    context "when user has no auth_id" do
      let!(:user) { create(:user, auth_id: nil) }

      it { is_expected.to be_success }

      it "skips Auth0 deletion" do
        delete_auth0_result
        expect(auth0_client).not_to have_received(:delete_user)
      end
    end

    context "when Auth0 returns AccessDenied" do
      before do
        allow(auth0_client).to receive(:delete_user).and_raise(Auth0::AccessDenied.new("Insufficient scope"))
      end

      it { is_expected.to be_success }

      it "reports the error to Sentry" do
        delete_auth0_result
        expect(Sentry).to have_received(:capture_exception).with(an_instance_of(Auth0::AccessDenied))
      end
    end

    context "when Auth0 returns NotFound" do
      before do
        allow(auth0_client).to receive(:delete_user).and_raise(Auth0::NotFound.new("User not found"))
      end

      it { is_expected.to be_success }

      it "reports the error to Sentry" do
        delete_auth0_result
        expect(Sentry).to have_received(:capture_exception).with(an_instance_of(Auth0::NotFound))
      end
    end

    context "when Auth0 returns Unauthorized" do
      let(:retry_client) { instance_double("Auth0Client", delete_user: nil) }

      before do
        allow(auth0_client).to receive(:delete_user).and_raise(Auth0::Unauthorized.new("Expired token"))
        allow(Auth::M2mClient).to receive(:client).and_return(auth0_client, retry_client)
      end

      it { is_expected.to be_success }

      it "reports the error to Sentry" do
        delete_auth0_result
        expect(Sentry).to have_received(:capture_exception).with(an_instance_of(Auth0::Unauthorized))
      end

      it "resets the M2M client and retries" do
        delete_auth0_result
        expect(Auth::M2mClient).to have_received(:reset!)
        expect(retry_client).to have_received(:delete_user).with(user.auth_id)
      end
    end

    context "when Auth0 returns an unhandled error" do
      before do
        allow(auth0_client).to receive(:delete_user).and_raise(StandardError.new("Network error"))
      end

      it "lets the error bubble up" do
        expect { delete_auth0_result }.to raise_error(StandardError, "Network error")
      end
    end
  end

  describe "#delete_user_record" do
    subject(:delete_user_result) { operation.send(:delete_user_record, user:) }

    let!(:onboarding) { create(:onboarding, user: user) }

    it { is_expected.to be_success }

    it "deletes the user" do
      delete_user_result
      expect(Auth::User.exists?(user.id)).to be false
    end

    it "deletes the onboarding record" do
      expect { delete_user_result }.to change(Onboarding, :count).by(-1)
    end

    it "deletes user activity records" do
      UserActivity.create!(user: user, activity_date: Date.current)
      expect { delete_user_result }.to change(UserActivity, :count).by(-1)
    end

    it "clears user roles" do
      user.add_role(:admin, personal_space)
      delete_user_result
      expect(Auth::Role.joins("INNER JOIN users_roles ON users_roles.role_id = roles.id")
                       .where(users_roles: { user_id: user.id }).count).to eq(0)
    end

    context "when user has CRM tickets from org spaces" do
      let!(:org_space) { create(:organization_space) }
      let!(:ticket) { create(:crm_ticket, user: user, space: org_space) }
      let!(:ticket_response) { create(:crm_ticket_response, ticket: ticket) }

      it "deletes CRM tickets and responses" do
        expect { delete_user_result }.to change(Crm::Ticket, :count).by(-1)
          .and change(Crm::TicketResponse, :count).by(-1)
      end
    end
  end
end
