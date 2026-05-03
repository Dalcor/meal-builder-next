interface Props {
  onClose: () => void;
}

// Mobile-only drag indicator at the top of bottom-sheet modals. Tapping
// it dismisses the modal — gives users an obvious close affordance even
// when the rest of the modal is full of inputs.
export default function DrawerHandle({ onClose }: Props) {
  return (
    <button
      type="button"
      onClick={onClose}
      className="sm:hidden flex justify-center pt-2 pb-1.5 -mb-1 active:bg-gray-50 w-full"
      aria-label="Закрити"
    >
      <span className="block w-10 h-1.5 bg-gray-300 rounded-full" />
    </button>
  );
}
