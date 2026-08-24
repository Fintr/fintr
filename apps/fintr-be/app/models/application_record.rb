# frozen_string_literal: true

class ApplicationRecord < ActiveRecord::Base
  primary_abstract_class

  UUID_FORMAT = /\A[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\z/i

  before_validation :reject_invalid_uuid_primary_key, on: :create, if: :uuid_primary_key?
  before_validation :assign_uuid_primary_key, on: :create, if: :uuid_primary_key?

  def self.clean_attributes
    (attribute_names - ["id", "created_at", "updated_at"]).map(&:to_sym)
  end

  def self.valid_uuid?(value)
    value.to_s.match?(UUID_FORMAT)
  end

  private

  def uuid_primary_key?
    return false unless self.class.primary_key == "id"
    return false unless self.class.column_names.include?("id")

    self.class.columns_hash["id"]&.sql_type == "uuid"
  end

  def reject_invalid_uuid_primary_key
    raw_id = id_before_type_cast
    return if raw_id.blank?
    return if self.class.valid_uuid?(raw_id)

    errors.add(:id, "must be a valid UUID")
  end

  def assign_uuid_primary_key
    return if errors[:id].any?

    self.id = SecureRandom.uuid if id.blank?
  end
end
