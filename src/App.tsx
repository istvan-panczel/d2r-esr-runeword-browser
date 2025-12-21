import { useDispatch, useSelector } from 'react-redux';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { initDataLoad, selectIsLoading } from '@/core/store';

function App() {
  const dispatch = useDispatch();
  const isLoading = useSelector(selectIsLoading);

  const handleButtonClick = () => {
    dispatch(initDataLoad());
  };

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Button onClick={handleButtonClick} disabled={isLoading}>
        {isLoading ? <Spinner className="mr-2" /> : null}
        {isLoading ? 'Loading...' : 'Test it!'}
      </Button>
    </div>
  );
}

export default App;
