# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Spaces::Space, type: :model do
  describe 'associations' do
    it { is_expected.to have_many(:transactions).class_name('Transactions::Transaction').dependent(:destroy) }
    it { is_expected.to have_many(:incomes).class_name('Transactions::Income').dependent(:destroy) }
    it { is_expected.to have_many(:expenses).class_name('Transactions::Expense').dependent(:destroy) }
    it { is_expected.to have_many(:space_users).class_name('Spaces::SpaceUser').dependent(:destroy) }
    it { is_expected.to have_many(:users).class_name('Auth::User').through(:space_users) }
    it { is_expected.to have_many(:categories).class_name('Transactions::Category').dependent(:destroy) }
    it { is_expected.to have_many(:income_categories).class_name('Transactions::Category') }
    it { is_expected.to have_many(:expense_categories).class_name('Transactions::Category') }
    it { is_expected.to have_many(:accounts).class_name('Transactions::Account').dependent(:destroy) }
    it { is_expected.to have_many(:budgets).class_name('Budget').dependent(:destroy) }
    it { is_expected.to have_many(:tickets).class_name('Crm::Ticket').dependent(:destroy) }
    it { is_expected.to have_one(:goal_description).class_name('GoalDescription').dependent(:destroy) }
    it { is_expected.to have_many(:conversations).class_name('Ai::Conversation').dependent(:destroy) }

    # Note: monthly_totals association exists in model but table doesn't exist in current schema
    # Skipping association test to avoid database errors
  end

  describe 'validations' do
    subject { build(:space) }

    it { is_expected.to validate_presence_of(:name) }
    it { is_expected.to validate_presence_of(:code) }
    it { is_expected.to validate_uniqueness_of(:code) }
    it { is_expected.to validate_presence_of(:currency) }
    it { is_expected.to validate_presence_of(:type) }
    it { is_expected.to validate_inclusion_of(:type).in_array(%w[Spaces::PersonalSpace Spaces::OrganizationSpace]) }
  end

  describe 'instance methods' do
    let(:space) { create(:space) }

    describe '#create_default_transaction_categories' do
      it 'delegates to Transactions::Category.create_default_categories' do
        expect(Transactions::Category).to receive(:create_default_categories).with(space)
        space.create_default_transaction_categories
      end
    end
  end

  describe 'factory' do
    it 'creates a valid space' do
      space = build(:space)
      expect(space).to be_valid
    end

    it 'creates a space with all required attributes' do
      space = create(:space)
      expect(space.name).to be_present
      expect(space.code).to be_present
      expect(space.currency).to be_present
      expect(space.type).to be_present
    end

    context 'with personal space factory' do
      it 'creates a valid personal space' do
        space = create(:personal_space)
        expect(space).to be_valid
        expect(space.type).to eq('Spaces::PersonalSpace')
      end
    end

    context 'with organization space factory' do
      it 'creates a valid organization space' do
        space = create(:organization_space)
        expect(space).to be_valid
        expect(space.type).to eq('Spaces::OrganizationSpace')
      end
    end
  end

  describe 'associations behavior' do
    let(:space) { create(:space) }

    context 'when checking dependent destroy configuration' do
      it 'has dependent destroy set for transactions association' do
        association = space.class.reflect_on_association(:transactions)
        expect(association.options[:dependent]).to eq(:destroy)
      end

      it 'has dependent destroy set for space_users association' do
        association = space.class.reflect_on_association(:space_users)
        expect(association.options[:dependent]).to eq(:destroy)
      end

      it 'has dependent destroy set for categories association' do
        association = space.class.reflect_on_association(:categories)
        expect(association.options[:dependent]).to eq(:destroy)
      end

      it 'has dependent destroy set for budgets association' do
        association = space.class.reflect_on_association(:budgets)
        expect(association.options[:dependent]).to eq(:destroy)
      end

      it 'has dependent destroy set for tickets association' do
        association = space.class.reflect_on_association(:tickets)
        expect(association.options[:dependent]).to eq(:destroy)
      end

      it 'has dependent destroy set for conversations association' do
        association = space.class.reflect_on_association(:conversations)
        expect(association.options[:dependent]).to eq(:destroy)
      end
    end

    describe 'filtered categories' do
      let!(:income_category) { create(:category, space: space, category_type: :income) }
      let!(:expense_category) { create(:category, space: space, category_type: :expense) }

      it 'returns only income categories through income_categories association' do
        expect(space.income_categories).to include(income_category)
        expect(space.income_categories).not_to include(expense_category)
      end

      it 'returns only expense categories through expense_categories association' do
        expect(space.expense_categories).to include(expense_category)
        expect(space.expense_categories).not_to include(income_category)
      end
    end

    describe 'association presence' do
      it 'can create associated space_users' do
        user = create(:user)
        space_user = space.space_users.create(user: user)
        expect(space_user).to be_persisted
        expect(space.space_users).to include(space_user)
      end

      it 'can create associated tickets' do
        user = create(:user)
        ticket = space.tickets.create(
          title: 'Test ticket',
          description: 'Test description',
          ticket_type: 'general_feedback',
          priority: 'medium',
          status: 'open',
          user: user
        )
        expect(ticket).to be_persisted
        expect(space.tickets).to include(ticket)
      end

      it 'can create associated conversations' do
        conversation = create(:ai_conversation, space: space)
        expect(conversation).to be_persisted
        expect(space.conversations).to include(conversation)
      end
    end
  end
end
