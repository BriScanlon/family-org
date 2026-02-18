import aio_pika
import json
from ..config import settings

async def send_sync_message(message_type: str, data: dict, routing_key: str = "sync_queue"):
    connection = await aio_pika.connect_robust(settings.RABBITMQ_URL)
    async with connection:
        channel = await connection.channel()
        message_body = json.dumps({"type": message_type, "data": data})
        await channel.default_exchange.publish(
            aio_pika.Message(body=message_body.encode()),
            routing_key=routing_key
        )
