import { render, screen } from '@testing-library/svelte';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import BattleChat from '../BattleChat.svelte';

afterEach(() => {
    vi.restoreAllMocks();
});

describe('BattleChat', () => {
    it('renders the placeholder state when no messages exist', () => {
        render(BattleChat);

        expect(screen.getByText('Battle chat ready')).toBeTruthy();
        expect(screen.getByPlaceholderText('Type your message...')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Send' })).toBeTruthy();
    });

    it('displays chat messages with timestamps and errors', () => {
        vi.spyOn(Date.prototype, 'toLocaleTimeString').mockReturnValue('10:00');

        render(BattleChat, {
            props: {
                messages: [
                    {
                        id: 'msg-1',
                        sender: 'Alice',
                        message: 'Hi there',
                        timestamp: 1_700_000_000_000,
                        origin: 'local'
                    },
                    {
                        id: 'msg-2',
                        sender: 'Server',
                        message: 'Unable to deliver message',
                        timestamp: 1_700_000_500_000,
                        error: 'Connection lost'
                    }
                ]
            }
        });

        expect(screen.getByText('Alice')).toBeTruthy();
        expect(screen.getByText('Server')).toBeTruthy();
        expect(screen.getByText('Hi there')).toBeTruthy();
        expect(screen.getByText('Unable to deliver message')).toBeTruthy();
        expect(screen.getByText('Connection lost')).toBeTruthy();
        expect(screen.getAllByText('10:00')).toHaveLength(2);
    });

    it('calls onSend with trimmed input and clears the field', async () => {
        const onSend = vi.fn();
        const user = userEvent.setup();

        render(BattleChat, {
            props: { onSend }
        });

        const input = screen.getByPlaceholderText('Type your message...');
        const sendButton = screen.getByRole('button', { name: 'Send' });

        await user.type(input, '   Hello world   ');
        await user.click(sendButton);

        expect(onSend).toHaveBeenCalledWith('Hello world');
        expect((input as HTMLInputElement).value).toBe('');

        await user.type(input, '   ');
        await user.click(sendButton);

        expect(onSend).toHaveBeenCalledTimes(1);
        expect((input as HTMLInputElement).value).toBe('');
    });

    it('honors the disabled state and shows status text', () => {
        render(BattleChat, {
            props: {
                sendDisabled: true,
                statusText: 'Connecting to battle chat...'
            }
        });

        const input = screen.getByPlaceholderText('Type your message...');
        const button = screen.getByRole('button', { name: 'Send' });

        expect((input as HTMLInputElement).disabled).toBe(true);
        expect((button as HTMLButtonElement).disabled).toBe(true);
        expect(screen.getByText('Connecting to battle chat...')).toBeTruthy();
    });
});
