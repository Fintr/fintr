# frozen_string_literal: true

class TransactionEditingChannel < ApplicationCable::Channel
  def subscribed
    @space_id = params[:space_id].to_s
    @transaction_id = params[:transaction_id].to_s

    unless @space_id.present? && @transaction_id.present?
      reject
      return
    end

    unless space_member?
      reject
      return
    end

    stream_from stream_name
    editors = TransactionEditing::PresenceRegistry.start_editing(
      space_id: @space_id,
      transaction_id: @transaction_id,
      user: current_user,
    )
    broadcast_editors(editors)
  end

  def unsubscribed
    return if @space_id.blank? || @transaction_id.blank? || current_user.blank?

    editors = TransactionEditing::PresenceRegistry.stop_editing(
      space_id: @space_id,
      transaction_id: @transaction_id,
      user_id: current_user.id,
    )
    broadcast_editors(editors)
  end

  def start_editing(_data = {})
    return unless @space_id.present? && @transaction_id.present?

    editors = TransactionEditing::PresenceRegistry.start_editing(
      space_id: @space_id,
      transaction_id: @transaction_id,
      user: current_user,
    )
    broadcast_editors(editors)
  end

  def stop_editing(_data = {})
    return unless @space_id.present? && @transaction_id.present?

    editors = TransactionEditing::PresenceRegistry.stop_editing(
      space_id: @space_id,
      transaction_id: @transaction_id,
      user_id: current_user.id,
    )
    broadcast_editors(editors)
  end

  private

  def stream_name
    TransactionEditing::PresenceRegistry.stream_key(
      space_id: @space_id,
      transaction_id: @transaction_id,
    )
  end

  def space_member?
    space = Spaces::Space.find_by(id: @space_id) ||
            Spaces::Space.find_by(code: @space_id)
    return false unless space

    @space_id = space.id.to_s
    Spaces::SpaceUser.exists?(
      space_id: space.id,
      user_id: current_user.id,
    )
  end

  def broadcast_editors(editors)
    ActionCable.server.broadcast(
      stream_name,
      {
        type: "editors",
        editors:,
      },
    )
  end
end
