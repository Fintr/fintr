# frozen_string_literal: true

class TransactionsChannel < ApplicationCable::Channel
  def subscribed
    @space_id = params[:space_id].to_s

    unless @space_id.present?
      Rails.logger.info("[TransactionsChannel] reject: missing space_id")
      reject
      return
    end

    unless space_member?
      Rails.logger.info(
        "[TransactionsChannel] reject: user=#{current_user&.id} not member of space=#{@space_id}",
      )
      reject
      return
    end

    stream_from stream_name
    Rails.logger.info(
      "[TransactionsChannel] subscribed user=#{current_user.id} stream=#{stream_name}",
    )
  end

  def unsubscribed
    # no-op
  end

  private

  def stream_name
    Transactions::Broadcasts::TransactionChange.stream_key(space_id: @space_id)
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
end
