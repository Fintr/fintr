# frozen_string_literal: true

require 'rails_helper'

RSpec.describe Entities::Serializers::EntitySerializer do
  subject(:serialized_hash) { described_class.render_as_hash(entity) }

  let(:user) { create(:user) }
  let(:space) { create(:personal_space, users: [user]) }
  let(:entity) do
    create(
      :entity,
      space: space,
      full_name: 'John Doe',
      entity_type: 'loan'
    )
  end

  it 'includes the id' do
    expect(serialized_hash[:id]).to eq(entity.id)
  end

  it 'includes the full_name' do
    expect(serialized_hash[:full_name]).to eq('John Doe')
  end

  it 'includes the entity_type' do
    expect(serialized_hash[:entity_type]).to eq('loan')
  end

  it 'serializes all expected fields' do
    expected_keys = [
      :id,
      :full_name,
      :entity_type
    ]
    expect(serialized_hash.keys).to match_array(expected_keys)
  end

  context 'when entity has different entity_type' do
    let(:entity) do
      create(
        :entity,
        space: space,
        full_name: 'Jane Smith',
        entity_type: 'borrower'
      )
    end

    it 'includes the correct entity_type' do
      expect(serialized_hash[:entity_type]).to eq('borrower')
    end

    it 'includes the correct full_name' do
      expect(serialized_hash[:full_name]).to eq('Jane Smith')
    end
  end

  context 'when entity has nil values' do
    let(:entity) do
      create(
        :entity,
        space: space,
        full_name: 'Test Entity',
        entity_type: 'loan'
      )
    end

    it 'still serializes all fields' do
      expect(serialized_hash).to have_key(:id)
      expect(serialized_hash).to have_key(:full_name)
      expect(serialized_hash).to have_key(:entity_type)
    end
  end
end
